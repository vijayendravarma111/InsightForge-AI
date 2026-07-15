import time
from fastapi import APIRouter, Query, HTTPException, status
from sqlalchemy import text
from app.core.database import engine

router = APIRouter(prefix="/analytics", tags=["SQL Analytics Studio"])

@router.post("/query", summary="Execute custom SQL queries")
def execute_query(
    sql_text: str = Query(..., description="Select query to run against database")
):
    """Executes a custom SQL query against PostgreSQL, enforcing read-only SELECT limits."""
    # Safety Check: only allow SELECT queries
    clean_sql = sql_text.strip()
    if not clean_sql.lower().startswith("select"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only read-only SELECT queries are allowed in the SQL Analytics Studio."
        )
        
    start_time = time.time()
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql_text))
            
            # Fetch column headers
            columns = list(result.keys())
            
            # Fetch rows (limit to 1000 for browser safety)
            rows = result.fetchmany(1000)
            
            # Format rows to list of dictionaries
            data = []
            for row in rows:
                row_dict = {}
                for idx, col in enumerate(columns):
                    val = row[idx]
                    # Map decmials / datetimes to serializable
                    if hasattr(val, 'isoformat'):
                        row_dict[col] = val.isoformat()
                    elif hasattr(val, 'to_eng_string'): # Decimals
                        row_dict[col] = float(val)
                    else:
                        row_dict[col] = val
                data.append(row_dict)
                
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            return {
                "status": "success",
                "execution_time_ms": execution_time_ms,
                "columns": columns,
                "row_count": len(data),
                "data": data
            }
            
    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": str(e),
                "execution_time_ms": execution_time_ms
            }
        )
