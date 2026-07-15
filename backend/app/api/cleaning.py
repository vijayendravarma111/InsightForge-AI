from fastapi import APIRouter, Query, Body, HTTPException, status
from app.services.cleaning_service import CleaningService
from app.core.exceptions import DataCleaningError

router = APIRouter(prefix="/cleaning", tags=["Data Cleaning"])

@router.get("/recommendations", summary="Get cleaning recommendations")
def get_recommendations(
    table_name: str = Query(..., description="Target table name in raw_imports")
):
    """Scans the target table and returns recommended cleaning rules (e.g. fill nulls, drop duplicates)."""
    try:
        recs = CleaningService.get_cleaning_recommendations(table_name)
        return {"table_name": table_name, "recommendations": recs}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recommendations: {str(e)}"
        )

@router.post("/preview", summary="Preview cleaning transformations")
def preview_clean(
    table_name: str = Query(..., description="Target table name"),
    rules: list = Body(..., description="List of cleaning rules to preview")
):
    """Applies rules to the table in-memory and returns a data preview slice without updating PostgreSQL."""
    try:
        result = CleaningService.apply_cleaning_rules(table_name, rules, preview_only=True)
        return result
    except DataCleaningError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/apply", summary="Apply cleaning transformations")
def apply_clean(
    table_name: str = Query(..., description="Target table name"),
    rules: list = Body(..., description="List of cleaning rules to apply")
):
    """Applies cleaning rules and overwrites the raw table in PostgreSQL, logging the audit trail."""
    try:
        result = CleaningService.apply_cleaning_rules(table_name, rules, preview_only=False)
        return result
    except DataCleaningError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/history", summary="Get cleaning history")
def get_history(
    table_name: str = Query(..., description="Target table name")
):
    """Fetches the log of cleaning configurations applied to this dataset."""
    return CleaningService.get_transformation_history(table_name)
