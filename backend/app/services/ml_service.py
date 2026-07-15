import pandas as pd
import numpy as np
from sqlalchemy import text
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.linear_model import Ridge
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, classification_report, confusion_matrix
from app.core.config import settings
from app.core.database import engine
from app.core.exceptions import MLEngineError

class MLService:
    @classmethod
    def run_sales_forecast(cls) -> dict:
        """Aggregate sales historically, build lag features, fit Ridge Regression,
        and forecast next 6 months of sales with confidence boundaries.
        """
        dw = settings.DW_SCHEMA
        query = f"""
            SELECT t.year, t.month, SUM(f.sales) as monthly_sales
            FROM {dw}.fact_sales f
            JOIN {dw}.dim_time t ON f.date_key = t.date_key
            GROUP BY t.year, t.month
            ORDER BY t.year, t.month
        """
        try:
            df = pd.read_sql(query, con=engine)
        except Exception as e:
            raise MLEngineError(f"Warehouse query failed: ensure ETL pipeline has run. Details: {str(e)}")
            
        if len(df) < 12:
            raise MLEngineError("Insufficient historical data (at least 12 months required) to run sales forecast.")
            
        # Create continuous date timeline
        df['date'] = pd.to_datetime(df[['year', 'month']].assign(day=1))
        df = df.set_index('date').resample('MS').fillna(0)
        df['monthly_sales'] = df['monthly_sales'].astype(float)
        
        # Build features: lags t-1, t-2, t-3, t-12 (seasonal)
        df['lag_1'] = df['monthly_sales'].shift(1)
        df['lag_2'] = df['monthly_sales'].shift(2)
        df['lag_3'] = df['monthly_sales'].shift(3)
        df['lag_12'] = df['monthly_sales'].shift(12)
        df['month_num'] = df.index.month
        
        # Drop rows with NaNs caused by shift
        df_clean = df.dropna()
        if len(df_clean) < 6:
             raise MLEngineError("Insufficient data after building lag features (at least 15 months total historical data needed).")
             
        X = df_clean[['lag_1', 'lag_2', 'lag_3', 'lag_12', 'month_num']]
        y = df_clean['monthly_sales']
        
        # Split and fit
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)
        
        model = Ridge(alpha=1.0)
        model.fit(X_train, y_train)
        
        # Evaluation
        train_preds = model.predict(X_train)
        test_preds = model.predict(X_test)
        
        mse = mean_squared_error(y_test, test_preds)
        r2 = r2_score(y_test, test_preds)
        
        # Multi-step Forecast for next 6 months
        forecast_dates = []
        forecast_values = []
        
        # Initialize rolling features with last known values
        last_known = df.tail(12) # need up to 12 months back
        
        current_date = df.index[-1]
        
        for i in range(6):
            current_date = current_date + pd.DateOffset(months=1)
            forecast_dates.append(current_date)
            
            # Retrieve lags from previously appended results
            lag1 = forecast_values[-1] if len(forecast_values) >= 1 else last_known['monthly_sales'].iloc[-1]
            lag2 = forecast_values[-2] if len(forecast_values) >= 2 else last_known['monthly_sales'].iloc[-2]
            lag3 = forecast_values[-3] if len(forecast_values) >= 3 else last_known['monthly_sales'].iloc[-3]
            
            # Seasonal lag (12 months ago)
            lag12_idx = -12 + i
            if lag12_idx >= 0:
                lag12 = forecast_values[lag12_idx]
            else:
                lag12 = last_known['monthly_sales'].iloc[lag12_idx]
                
            pred_features = np.array([[lag1, lag2, lag3, lag12, current_date.month]])
            pred_val = max(0.0, float(model.predict(pred_features)[0]))
            forecast_values.append(pred_val)
            
        # Compile historical timeline for plotting
        historical_timeline = [
            {"date": date.strftime('%Y-%m-%d'), "sales": float(val)} 
            for date, val in zip(df.index, df['monthly_sales'])
        ]
        
        # Confidence interval approximation (using standard error of predictions)
        residuals = y_train - train_preds
        std_err = float(np.std(residuals))
        
        forecast_timeline = [
            {
                "date": date.strftime('%Y-%m-%d'), 
                "sales": float(val),
                "lower_bound": max(0.0, float(val - 1.96 * std_err)),
                "upper_bound": float(val + 1.96 * std_err)
            }
            for date, val in zip(forecast_dates, forecast_values)
        ]
        
        return {
            "metrics": {
                "mse": round(mse, 2),
                "rmse": round(np.sqrt(mse), 2),
                "r2": round(r2, 4)
            },
            "historical": historical_timeline,
            "forecast": forecast_timeline,
            "coefficients": {col: round(coef, 2) for col, coef in zip(X.columns, model.coef_)}
        }

    @classmethod
    def run_customer_classification(cls) -> dict:
        """Classify customers into High Value (Platinum/Gold) or Standard based on purchase behaviors.
        Trains a Random Forest Classifier using RFM and discount metrics.
        """
        dw = settings.DW_SCHEMA
        # Fetch customers with their RFM aggregates
        query = f"""
            SELECT customer_key, customer_id, customer_name, recency_days, frequency, monetary_value, segment, customer_tier
            FROM {dw}.dim_customers
        """
        
        # Also query order detail averages per customer
        order_query = f"""
            SELECT customer_key, AVG(sales) as avg_order_sales, AVG(discount) as avg_discount, AVG(profit) as avg_profit
            FROM {dw}.fact_sales
            GROUP BY customer_key
        """
        
        try:
            cust_df = pd.read_sql(query, con=engine)
            order_df = pd.read_sql(order_query, con=engine)
        except Exception as e:
            raise MLEngineError(f"Warehouse query failed: ensure ETL pipeline has run. Details: {str(e)}")
            
        if len(cust_df) < 20:
            raise MLEngineError("Insufficient customer records (at least 20 required) to run classification.")
            
        # Merge datasets
        df = pd.merge(cust_df, order_df, on='customer_key', how='inner')
        
        # Target variable: High Value Customer (Platinum / Gold = 1, Standard = 0)
        df['is_high_value'] = df['customer_tier'].apply(lambda x: 1 if x in ['Platinum', 'Gold'] else 0)
        
        # Features
        # Segment needs encoding
        df_encoded = pd.get_dummies(df, columns=['segment'], drop_first=True)
        
        feature_cols = ['recency_days', 'frequency', 'monetary_value', 'avg_order_sales', 'avg_discount', 'avg_profit']
        # Add encoded segment columns
        for col in df_encoded.columns:
            if col.startswith('segment_'):
                feature_cols.append(col)
                
        X = df_encoded[feature_cols].fillna(0)
        y = df_encoded['is_high_value']
        
        # Check class balance
        if y.nunique() < 2 or y.value_counts().min() < 3:
             raise MLEngineError("Highly imbalanced datasets. Cannot train classifier properly without samples of both tiers.")
             
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)
        
        model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=5)
        model.fit(X_train, y_train)
        
        # Predict & Evaluate
        preds = model.predict(X_test)
        probs = model.predict_proba(X_test)[:, 1]
        
        report = classification_report(y_test, preds, output_dict=True)
        cm = confusion_matrix(y_test, preds).tolist()
        
        # Feature Importance
        importances = model.feature_importances_
        feature_importance_list = [
            {"feature": name, "importance": round(float(imp), 4)}
            for name, imp in zip(feature_cols, importances)
        ]
        feature_importance_list = sorted(feature_importance_list, key=lambda x: x["importance"], reverse=True)
        
        # Return summary of customer profiles with their predicted probability
        df['high_value_probability'] = model.predict_proba(X[feature_cols])[:, 1]
        df['predicted_high_value'] = model.predict(X[feature_cols])
        
        predictions_output = df[['customer_key', 'customer_id', 'customer_name', 'customer_tier', 'high_value_probability', 'predicted_high_value']].head(100).to_dict(orient='records')
        
        return {
            "metrics": {
                "accuracy": round(report["accuracy"], 4),
                "precision": round(report["1"]["precision"] if "1" in report else 0.0, 4),
                "recall": round(report["1"]["recall"] if "1" in report else 0.0, 4),
                "f1_score": round(report["1"]["f1-score"] if "1" in report else 0.0, 4),
            },
            "confusion_matrix": cm,
            "feature_importance": feature_importance_list,
            "predictions": predictions_output
        }

    @classmethod
    def run_anomaly_detection(cls) -> dict:
        """Applies Isolation Forest to transaction lines in fact_sales
        to identify outlier/fraudulent-looking orders.
        """
        dw = settings.DW_SCHEMA
        query = f"""
            SELECT f.fact_key, f.order_id, p.product_name, f.sales, f.quantity, f.discount, f.profit
            FROM {dw}.fact_sales f
            JOIN {dw}.dim_products p ON f.product_key = p.product_key
        """
        try:
            df = pd.read_sql(query, con=engine)
        except Exception as e:
            raise MLEngineError(f"Warehouse query failed: ensure ETL pipeline has run. Details: {str(e)}")
            
        if len(df) < 50:
            raise MLEngineError("Insufficient transactional data (at least 50 required) to run anomaly detection.")
            
        # Fit Isolation Forest on Sales, Quantity, Discount, Profit
        features = ['sales', 'quantity', 'discount', 'profit']
        X = df[features].fillna(0)
        
        # Isolation Forest - contamination specifies expected outlier ratio (e.g. 2%)
        clf = IsolationForest(contamination=0.02, random_state=42)
        # Predict outputs -1 for anomalies and 1 for normals
        df['anomaly_label'] = clf.fit_predict(X)
        df['anomaly_score'] = clf.decision_function(X) # lower score means more anomalous
        
        # Format anomalies
        anomalies_df = df[df['anomaly_label'] == -1].copy()
        
        # Convert to dictionary and return
        anomalies_list = anomalies_df.head(100).replace({np.nan: None}).to_dict(orient='records')
        total_anomalies = len(anomalies_df)
        
        # Return samples + metrics
        return {
            "total_transactions": len(df),
            "anomaly_count": total_anomalies,
            "anomaly_rate_pct": round((total_anomalies / len(df)) * 100, 2),
            "anomalies": anomalies_list
        }
