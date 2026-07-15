from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine

router = APIRouter(prefix="/warehouse", tags=["Data Warehouse"])

@router.get("/summary", summary="Get Warehouse Star Schema Summary")
def get_warehouse_summary():
    """Returns row counts and metadata descriptions for fact and dimension tables."""
    dw = settings.DW_SCHEMA
    tables = ["dim_customers", "dim_products", "dim_geography", "dim_time", "fact_sales"]
    summary = {}
    
    with engine.connect() as conn:
        for tbl in tables:
            try:
                # Check if table exists
                exists_query = text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = :schema AND table_name = :name
                    )
                """)
                exists = conn.execute(exists_query, {"schema": dw, "name": tbl}).fetchone()[0]
                
                if exists:
                    count_res = conn.execute(text(f"SELECT COUNT(*) FROM {dw}.{tbl}")).fetchone()
                    summary[tbl] = {
                        "exists": True,
                        "row_count": count_res[0] if count_res else 0
                    }
                else:
                    summary[tbl] = {
                        "exists": False,
                        "row_count": 0
                    }
            except Exception:
                summary[tbl] = {
                    "exists": False,
                    "row_count": 0
                }
                
    return {
        "schema": dw,
        "tables": summary,
        "star_schema_role": {
            "dim_customers": "Dimension table storing customer profiles and RFM statistics",
            "dim_products": "Dimension table storing product categorization details",
            "dim_geography": "Dimension table storing location hierarchies",
            "dim_time": "Dimension table storing time granularities",
            "fact_sales": "Central Fact table storing transactional variables (Sales, Quantity, Profit, Discount)"
        }
    }
