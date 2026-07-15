from fastapi import APIRouter, UploadFile, File, Query, HTTPException, status
from app.services.import_service import ImportService
from app.core.exceptions import DataImportError, DataValidationError

router = APIRouter(prefix="/import", tags=["Data Import"])

@router.get("/datasets", summary="List available datasets")
def list_datasets():
    """Lists files saved in the upload directory."""
    return ImportService.get_available_datasets()

@router.post("/upload", summary="Upload a custom dataset (CSV/Excel)")
async def upload_dataset(file: UploadFile = File(...)):
    """Saves an uploaded dataset file to local storage."""
    filename = file.filename
    if not filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only CSV and Excel (.xlsx/.xls) are supported."
        )
    try:
        contents = await file.read()
        saved_name = ImportService.save_upload(contents, filename)
        return {"status": "success", "filename": saved_name}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )

@router.post("/load", summary="Load a dataset into PostgreSQL raw_imports")
def load_dataset(filename: str = Query(None, description="Filename of uploaded dataset. If omitted, seeds default Superstore dataset.")):
    """Loads an uploaded or seeded dataset into the PostgreSQL database `raw_imports` schema."""
    try:
        result = ImportService.load_dataset_to_postgres(filename)
        return result
    except (DataImportError, DataValidationError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
