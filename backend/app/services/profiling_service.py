import pandas as pd
import numpy as np
import duckdb
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine, get_duckdb_conn
from app.core.exceptions import InsightForgeError

class ProfilingService:
    @staticmethod
    def get_table_dataframe(table_name: str, schema: str = None) -> pd.DataFrame:
        """Helper to fetch a table as a Pandas DataFrame."""
        if not schema:
            schema = settings.RAW_SCHEMA
            
        # Validate table name to avoid injection
        clean_table = table_name.lower().strip().replace(";", "").replace("'", "")
        clean_schema = schema.lower().strip().replace(";", "").replace("'", "")
        
        query = f"SELECT * FROM {clean_schema}.{clean_table}"
        try:
            return pd.read_sql(query, con=engine)
        except Exception as e:
            raise InsightForgeError(f"Table '{schema}.{table_name}' not found or cannot be queried: {str(e)}")

    @classmethod
    def profile_table(cls, table_name: str, schema: str = None) -> dict:
        """Profiles a PostgreSQL table and calculates summary metrics and quality dimensions."""
        df = cls.get_table_dataframe(table_name, schema)
        
        row_count = len(df)
        col_count = len(df.columns)
        
        if row_count == 0:
            return {"error": "Empty dataset"}

        # Initialize structures
        column_summaries = {}
        missing_count = 0
        total_elements = row_count * col_count
        duplicate_rows = int(df.duplicated().sum())

        # Establish DuckDB for fast ad-hoc checks (e.g. histograms/stats)
        con = get_duckdb_conn()
        
        # Pearson Correlation Matrix (numeric columns only)
        numeric_df = df.select_dtypes(include=[np.number])
        correlation_matrix = {}
        if not numeric_df.empty:
            corr = numeric_df.corr().replace({np.nan: None}).to_dict()
            correlation_matrix = corr
            
        # Outlier counts (IQR based)
        outliers_summary = {}
        
        # Detailed Column analysis
        for col in df.columns:
            series = df[col]
            nulls = int(series.isnull().sum())
            missing_count += nulls
            null_pct = round((nulls / row_count) * 100, 2)
            unique_vals = int(series.nunique())
            
            # Basic stats
            col_type = str(series.dtype)
            summary = {
                "type": col_type,
                "null_count": nulls,
                "null_percentage": null_pct,
                "unique_count": unique_vals,
            }
            
            # Numeric column stats
            if np.issubdtype(series.dtype, np.number):
                non_null_numeric = series.dropna()
                if not non_null_numeric.empty:
                    # Basic distribution
                    summary.update({
                        "min": float(non_null_numeric.min()),
                        "max": float(non_null_numeric.max()),
                        "mean": round(float(non_null_numeric.mean()), 4),
                        "median": round(float(non_null_numeric.median()), 4),
                        "std_dev": round(float(non_null_numeric.std()), 4) if len(non_null_numeric) > 1 else 0.0,
                    })
                    
                    # Outliers detection (IQR)
                    q1 = non_null_numeric.quantile(0.25)
                    q3 = non_null_numeric.quantile(0.75)
                    iqr = q3 - q1
                    lower_bound = q1 - 1.5 * iqr
                    upper_bound = q3 + 1.5 * iqr
                    outliers = non_null_numeric[(non_null_numeric < lower_bound) | (non_null_numeric > upper_bound)]
                    outliers_count = len(outliers)
                    outliers_summary[col] = outliers_count
                    summary["outlier_count"] = outliers_count
                    
                    # Distribution / Histogram using DuckDB
                    try:
                        # Register dataframe to DuckDB
                        con.register('df_local', df)
                        hist_res = con.execute(f"""
                            SELECT 
                                min({col}) as min_val, 
                                max({col}) as max_val,
                                (max({col}) - min({col})) / 10.0 as bin_width
                            FROM df_local
                            WHERE {col} IS NOT NULL
                        """).fetchone()
                        
                        min_v, max_v, bin_w = hist_res
                        if bin_w and bin_w > 0:
                            hist_query = f"""
                                SELECT 
                                    floor(({col} - {min_v}) / {bin_w}) as bin_idx,
                                    count(*) as bin_count
                                FROM df_local
                                WHERE {col} IS NOT NULL
                                GROUP BY bin_idx
                                ORDER BY bin_idx
                            """
                            bins = con.execute(hist_query).fetchall()
                            summary["histogram"] = [
                                {
                                    "bin_start": round(min_v + idx * bin_w, 2),
                                    "bin_end": round(min_v + (idx + 1) * bin_w, 2),
                                    "count": count
                                } for idx, count in bins if idx is not None and idx >= 0 and idx < 10
                            ]
                    except Exception:
                        summary["histogram"] = []
            
            column_summaries[col] = summary

        # ----------------------------------------------------
        # Enterprise Data Quality Score Calculation
        # ----------------------------------------------------
        # 1. Completeness: % of non-null cells
        completeness = round(((total_elements - missing_count) / total_elements) * 100, 2)
        
        # 2. Consistency: Type compliance (check column names containing "date" for valid date formats)
        date_consistency_scores = []
        for col in df.columns:
            if "date" in col.lower() or "time" in col.lower():
                series = df[col].dropna()
                if not series.empty:
                    # Test date parsing rates
                    parsed = pd.to_datetime(series, errors='coerce')
                    valid_dates = parsed.notnull().sum()
                    date_consistency_scores.append(valid_dates / len(series))
        consistency = round((sum(date_consistency_scores)/len(date_consistency_scores) * 100) if date_consistency_scores else 100.0, 2)
        
        # 3. Validity: Verify positive/non-negative constraint violations on fields like sales/profit/quantity
        validity_scores = []
        for col in df.columns:
            lower_col = col.lower()
            if "sales" in lower_col or "quantity" in lower_col:
                series = df[col].dropna()
                if not series.empty:
                    valid_count = (series >= 0).sum()
                    validity_scores.append(valid_count / len(series))
        validity = round((sum(validity_scores)/len(validity_scores) * 100) if validity_scores else 100.0, 2)
        
        # 4. Uniqueness: Ratio of non-duplicated rows
        uniqueness = round(((row_count - duplicate_rows) / row_count) * 100, 2)
        
        # 5. Accuracy: Absence of extreme outliers in numeric fields
        accuracy_scores = []
        for col, outlier_cnt in outliers_summary.items():
            col_len = len(df[col].dropna())
            if col_len > 0:
                accuracy_scores.append((col_len - outlier_cnt) / col_len)
        accuracy = round((sum(accuracy_scores)/len(accuracy_scores) * 100) if accuracy_scores else 100.0, 2)
        
        # Overall Weighted Data Quality Score
        # Completeness: 30%, Consistency: 20%, Validity: 20%, Uniqueness: 15%, Accuracy: 15%
        overall_score = round(
            (completeness * 0.30) + 
            (consistency * 0.20) + 
            (validity * 0.20) + 
            (uniqueness * 0.15) + 
            (accuracy * 0.15), 
            2
        )

        return {
            "table_name": table_name,
            "row_count": row_count,
            "col_count": col_count,
            "duplicate_rows": duplicate_rows,
            "missing_cells_pct": round((missing_count / total_elements) * 100, 2),
            "columns": column_summaries,
            "correlation_matrix": correlation_matrix,
            "outliers": outliers_summary,
            "quality_dimensions": {
                "completeness": completeness,
                "consistency": consistency,
                "validity": validity,
                "uniqueness": uniqueness,
                "accuracy": accuracy,
                "overall": overall_score
            }
        }
