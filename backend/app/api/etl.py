from fastapi import APIRouter, Query, HTTPException, status
from app.services.etl_service import ETLService
from app.core.exceptions import ETLExecutionError

router = APIRouter(prefix="/etl", tags=["ETL Engine"])

@router.post("/run", summary="Run ETL Pipeline")
def run_etl(
    table_name: str = Query(..., description="Target raw table name to ingest and process")
):
    """Triggers the automated ETL pipeline: sanitizes data using recommendations,
    extracts key dimensions (dim_customers, dim_products, dim_geography, dim_time),
    and loads the final fact table into the warehouse schema.
    """
    try:
        result = ETLService.execute_pipeline(table_name)
        return result
    except ETLExecutionError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ETL Execution failed: {str(e)}"
        )

@router.get("/logs", summary="Get ETL Pipeline logs")
def get_etl_logs():
    """Returns history log entries of pipeline executions."""
    return ETLService.get_pipeline_logs()
