from fastapi import Request, status
from fastapi.responses import JSONResponse

class InsightForgeError(Exception):
    """Base exception for InsightForge AI application."""
    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

class DataImportError(InsightForgeError):
    """Raised when data ingestion fails."""
    pass

class DataValidationError(InsightForgeError):
    """Raised when imported data fails schema validation rules."""
    pass

class DataCleaningError(InsightForgeError):
    """Raised when a cleaning operation fails."""
    pass

class ETLExecutionError(InsightForgeError):
    """Raised when the ETL pipeline fails to execute or load."""
    pass

class MLEngineError(InsightForgeError):
    """Raised when machine learning fit or predict fails."""
    pass

async def insightforge_exception_handler(request: Request, exc: InsightForgeError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "error_type": exc.__class__.__name__}
    )
