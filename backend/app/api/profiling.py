from fastapi import APIRouter, Query, HTTPException, status
from app.services.profiling_service import ProfilingService
from app.core.exceptions import InsightForgeError

router = APIRouter(prefix="/profiling", tags=["Data Profiling"])

@router.get("/", summary="Profile a table")
def profile_table(
    table_name: str = Query(..., description="Target table name in the database"),
    schema: str = Query(None, description="Schema containing the table. Defaults to raw_imports.")
):
    """Executes the profiling engine on a target table, generating summary statistics
    and checking data quality dimensions (Completeness, Consistency, Validity, Uniqueness, Accuracy).
    """
    try:
        profile = ProfilingService.profile_table(table_name, schema)
        return profile
    except InsightForgeError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profiling failed: {str(e)}"
        )
