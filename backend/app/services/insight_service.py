from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine
from app.services.ml_service import MLService

class InsightService:
    @classmethod
    def generate_dashboard_insights(cls) -> dict:
        """Runs statistics over the data warehouse and constructs a detailed,
        highly structured, rule-based markdown insight summary.
        """
        dw = settings.DW_SCHEMA
        
        # Check if tables exist
        try:
            with engine.connect() as conn:
                res = conn.execute(text(f"SELECT COUNT(*) FROM {dw}.fact_sales")).fetchone()
                if not res or res[0] == 0:
                     return cls._get_empty_insights()
        except Exception:
             return cls._get_empty_insights()
             
        # Compute Stats to feed rules
        stats = cls._compute_insight_stats(dw)
        
        # Build findings list
        findings = []
        risks = []
        opportunities = []
        actions = []
        
        # Rule 1: High Discount Impact on Profit
        if stats["avg_discount"] > 0.15:
            findings.append(f"Average transaction discount is high at {round(stats['avg_discount']*100, 1)}%. This decreases profit margins across product lines.")
            risks.append("Profit margins are heavily compressed by discounting. Several product lines could become net-loss items if discounts are not managed.")
            actions.append("Implement discount controls to limit maximum transactional discount to 15% on high-demand categories.")
        else:
            findings.append(f"Average discount rate remains healthy at {round(stats['avg_discount']*100, 1)}%, preserving category profit margins.")
            
        # Rule 2: Segment sales performance
        top_segment = stats["top_segment"]
        findings.append(f"The '{top_segment}' segment leads in total volume, generating ${stats['segment_revenue']:,} in revenue.")
        
        # Rule 3: Unprofitable products / categories
        if stats["unprofitable_categories"]:
            unprof_cats = ", ".join(stats["unprofitable_categories"])
            findings.append(f"Identified net-unprofitable categories: {unprof_cats}.")
            risks.append(f"Negative profit trend in: {unprof_cats}. Shipping costs or markdown discounts are outweighing sale prices.")
            actions.append(f"Audit supplier costs and shipping surcharges for {unprof_cats} immediately.")
        else:
            findings.append("All primary product categories are profitable.")
            
        # Rule 4: Regional growth / high performance
        top_region = stats["top_region"]
        findings.append(f"Regional sales concentration is highest in the '{top_region}' region with ${stats['region_revenue']:,} in revenue.")
        opportunities.append(f"Capitalize on high sales volume in '{top_region}' by introducing premium product packages and loyalty rewards.")
        
        # Rule 5: ML Forecasting trend
        try:
            forecast_res = MLService.run_sales_forecast()
            forecast_points = forecast_res["forecast"]
            first_val = forecast_points[0]["sales"]
            last_val = forecast_points[-1]["sales"]
            trend_pct = ((last_val - first_val) / first_val) * 100
            
            if trend_pct > 5.0:
                findings.append(f"Sales forecast indicates a strong upward trajectory over the next 6 months, projecting a +{round(trend_pct, 1)}% growth rate.")
                opportunities.append(f"Scale up inventory levels in the upcoming quarters to support the forecasted {round(trend_pct, 1)}% sales expansion.")
            elif trend_pct < -5.0:
                findings.append(f"Sales forecast projects a contraction of {round(trend_pct, 1)}% over the next 6 months due to historical seasonal trends.")
                risks.append(f"Forecasted sales dip of {round(abs(trend_pct), 1)}% indicates upcoming cashflow compression.")
                actions.append("Launch promotional bundles and off-season clearance events to smooth out the forecasted sales contraction.")
            else:
                findings.append("Sales forecast indicates a stable revenue stream with minimal variance over the next 6 months.")
        except Exception:
            findings.append("Historical timeline is too short for reliable sales forecast projections.")
            
        # Rule 6: Anomaly rate
        try:
            anomaly_res = MLService.run_anomaly_detection()
            rate = anomaly_res["anomaly_rate_pct"]
            if rate > 2.5:
                findings.append(f"Isolation Forest flagged a high transaction anomaly rate of {rate}%.")
                risks.append("Elevated count of order anomalies suggests potential data entry faults, billing errors, or fraud leakage.")
                actions.append("Initiate automated post-billing audits for orders flagged by Anomaly Detection.")
            else:
                findings.append(f"Transaction anomaly rate is within standard boundaries ({rate}%).")
        except Exception:
            pass

        # Rule 7: High Value Customer classification
        try:
            class_res = MLService.run_customer_classification()
            feature_imp = class_res["feature_importance"]
            top_feature = feature_imp[0]["feature"] if feature_imp else "monetary_value"
            
            findings.append(f"Random Forest classification identifies '{top_feature}' as the primary predictor of high-value customer conversion.")
            opportunities.append(f"Increase frequency of touchpoints with segments close to threshold metrics in '{top_feature}'.")
            actions.append(f"Personalize marketing outreach highlighting products that match the characteristics of the high-value predictor variable ({top_feature}).")
        except Exception:
            pass
            
        # Default safety additions
        if not risks:
            risks.append("No critical system risks identified. Maintain current operational discount limits.")
        if not opportunities:
            opportunities.append("Expand distribution channels in central region segments exhibiting rising frequency scores.")
        if not actions:
            actions.append("Maintain baseline discount limits and review sales logs monthly.")

        return {
            "key_findings": findings,
            "business_risks": risks,
            "growth_opportunities": opportunities,
            "recommended_actions": actions
        }

    @staticmethod
    def _compute_insight_stats(dw: str) -> dict:
        """Executes analytical aggregates in SQL to feed rules."""
        stats = {
            "avg_discount": 0.0,
            "top_segment": "Consumer",
            "segment_revenue": 0.0,
            "top_region": "West",
            "region_revenue": 0.0,
            "unprofitable_categories": []
        }
        
        with engine.connect() as conn:
            # Avg Discount
            res = conn.execute(text(f"SELECT AVG(discount) FROM {dw}.fact_sales")).fetchone()
            if res and res[0] is not None:
                stats["avg_discount"] = float(res[0])
                
            # Top Segment
            res = conn.execute(text(f"""
                SELECT c.segment, SUM(f.sales) as rev
                FROM {dw}.fact_sales f
                JOIN {dw}.dim_customers c ON f.customer_key = c.customer_key
                GROUP BY c.segment ORDER BY rev DESC LIMIT 1
            """)).fetchone()
            if res:
                stats["top_segment"] = res[0]
                stats["segment_revenue"] = round(float(res[1]), 2)
                
            # Top Region
            res = conn.execute(text(f"""
                SELECT g.region, SUM(f.sales) as rev
                FROM {dw}.fact_sales f
                JOIN {dw}.dim_geography g ON f.geo_key = g.geo_key
                GROUP BY g.region ORDER BY rev DESC LIMIT 1
            """)).fetchone()
            if res:
                stats["top_region"] = res[0]
                stats["region_revenue"] = round(float(res[1]), 2)
                
            # Unprofitable Categories
            res = conn.execute(text(f"""
                SELECT p.category, SUM(f.profit) as profit
                FROM {dw}.fact_sales f
                JOIN {dw}.dim_products p ON f.product_key = p.product_key
                GROUP BY p.category
                HAVING SUM(f.profit) < 0
            """)).fetchall()
            stats["unprofitable_categories"] = [row[0] for row in res]
            
        return stats

    @staticmethod
    def _get_empty_insights() -> dict:
        return {
            "key_findings": ["No warehouse data available. Please upload a dataset and execute the ETL pipeline to generate insights."],
            "business_risks": ["Awaiting warehouse load."],
            "growth_opportunities": ["Awaiting warehouse load."],
            "recommended_actions": ["Awaiting warehouse load."]
        }
