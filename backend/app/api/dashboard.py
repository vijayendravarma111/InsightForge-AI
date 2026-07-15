from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine
from app.services.insight_service import InsightService

router = APIRouter(prefix="/dashboard", tags=["Business Dashboard"])

@router.get("/kpis", summary="Get core business KPIs")
def get_kpis():
    """Aggregates and returns total revenue, quantity, average discount, and profits."""
    dw = settings.DW_SCHEMA
    query = text(f"""
        SELECT 
            SUM(sales) as total_revenue,
            SUM(profit) as total_profit,
            AVG(discount) as avg_discount,
            SUM(quantity) as total_orders
        FROM {dw}.fact_sales
    """)
    try:
        with engine.connect() as conn:
            row = conn.execute(query).fetchone()
            if not row or row[0] is None:
                return {
                    "total_revenue": 0.0,
                    "total_profit": 0.0,
                    "avg_discount": 0.0,
                    "total_orders": 0,
                    "profit_margin": 0.0
                }
            
            rev = float(row[0])
            profit = float(row[1])
            avg_disc = float(row[2])
            orders = int(row[3])
            margin = round((profit / rev) * 100, 2) if rev > 0 else 0.0
            
            return {
                "total_revenue": round(rev, 2),
                "total_profit": round(profit, 2),
                "avg_discount": round(avg_disc, 4),
                "total_orders": orders,
                "profit_margin": margin
            }
    except Exception:
        return {
            "total_revenue": 0.0,
            "total_profit": 0.0,
            "avg_discount": 0.0,
            "total_orders": 0,
            "profit_margin": 0.0
        }

@router.get("/charts", summary="Get dashboard visualization datasets")
def get_charts():
    """Fetches series data for trends, products, categories, and regions."""
    dw = settings.DW_SCHEMA
    charts = {}
    
    with engine.connect() as conn:
        # 1. Revenue & Profit Trend
        try:
            trend_q = text(f"""
                SELECT t.year, t.month, SUM(f.sales) as sales, SUM(f.profit) as profit
                FROM {dw}.fact_sales f
                JOIN {dw}.dim_time t ON f.date_key = t.date_key
                GROUP BY t.year, t.month
                ORDER BY t.year, t.month
            """)
            res = conn.execute(trend_q).fetchall()
            charts["trends"] = [
                {"period": f"{row[0]}-{str(row[1]).zfill(2)}", "sales": float(row[2]), "profit": float(row[3])}
                for row in res
            ]
        except Exception:
            charts["trends"] = []

        # 2. Product Category Performance
        try:
            cat_q = text(f"""
                SELECT p.category, SUM(f.sales) as sales, SUM(f.profit) as profit
                FROM {dw}.fact_sales f
                JOIN {dw}.dim_products p ON f.product_key = p.product_key
                GROUP BY p.category
                ORDER BY sales DESC
            """)
            res = conn.execute(cat_q).fetchall()
            charts["categories"] = [
                {"category": row[0], "sales": float(row[1]), "profit": float(row[2])}
                for row in res
            ]
        except Exception:
            charts["categories"] = []

        # 3. Regional Performance
        try:
            region_q = text(f"""
                SELECT g.region, SUM(f.sales) as sales, SUM(f.profit) as profit
                FROM {dw}.fact_sales f
                JOIN {dw}.dim_geography g ON f.geo_key = g.geo_key
                GROUP BY g.region
                ORDER BY sales DESC
            """)
            res = conn.execute(region_q).fetchall()
            charts["regions"] = [
                {"region": row[0], "sales": float(row[1]), "profit": float(row[2])}
                for row in res
            ]
        except Exception:
            charts["regions"] = []

        # 4. Top Products (Limit 10)
        try:
            prod_q = text(f"""
                SELECT p.product_name, SUM(f.sales) as sales, SUM(f.profit) as profit
                FROM {dw}.fact_sales f
                JOIN {dw}.dim_products p ON f.product_key = p.product_key
                GROUP BY p.product_name
                ORDER BY sales DESC
                LIMIT 10
            """)
            res = conn.execute(prod_q).fetchall()
            charts["products"] = [
                {"product_name": row[0][:40] + "..." if len(row[0]) > 40 else row[0], "sales": float(row[1]), "profit": float(row[2])}
                for row in res
            ]
        except Exception:
            charts["products"] = []
            
    return charts

@router.get("/insights", summary="Get AI rule-based dashboard insights")
def get_insights():
    """Generates Key Findings, Risks, Growth Opportunities, and Actions from data metrics."""
    return InsightService.generate_dashboard_insights()
