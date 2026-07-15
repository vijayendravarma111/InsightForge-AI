from fastapi import APIRouter, HTTPException, status
from app.services.ml_service import MLService
from app.core.exceptions import MLEngineError

router = APIRouter(prefix="/ml", tags=["Machine Learning"])

@router.get("/forecast", summary="Retrieve Sales Forecast results")
def get_forecast():
    """Runs a multi-step Ridge Regression forecast on monthly warehouse sales."""
    try:
        return MLService.run_sales_forecast()
    except MLEngineError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/classification", summary="Retrieve High-Value Customer Classification results")
def get_classification():
    """Trains a Random Forest Classifier using RFM customer attributes to predict customer tiering."""
    try:
        return MLService.run_customer_classification()
    except MLEngineError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/anomalies", summary="Retrieve Transaction Anomaly Detection results")
def get_anomalies():
    """Fits Isolation Forest over sales lines to isolate fraudulent or abnormal transactions."""
    try:
        return MLService.run_anomaly_detection()
    except MLEngineError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
