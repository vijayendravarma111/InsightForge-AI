import os
from fastapi import APIRouter, Query, HTTPException, status
from fastapi.responses import FileResponse
from app.core.config import settings
from app.utils.pdf_generator import PDFGenerator
from app.services.profiling_service import ProfilingService
from app.services.ml_service import MLService
from app.services.insight_service import InsightService

router = APIRouter(prefix="/report", tags=["Executive Report"])

@router.get("/generate", summary="Generate Executive PDF Report")
def generate_report(
    table_name: str = Query(..., description="Target table name in raw_imports to generate the report from")
):
    """Compiles all data engineering profiles, ML forecasts, anomalies, classification summaries,
    and rule-based insights into a stylized downloadable PDF document.
    """
    os.makedirs(settings.REPORT_DIR, exist_ok=True)
    report_filename = f"executive_report_{table_name}.pdf"
    output_path = os.path.join(settings.REPORT_DIR, report_filename)
    
    try:
        # 1. Fetch profiling
        data_profile = ProfilingService.profile_table(table_name)
        
        # 2. Fetch ML forecast
        forecast_data = MLService.run_sales_forecast()
        
        # 3. Fetch ML classification
        classification_data = MLService.run_customer_classification()
        
        # 4. Fetch ML anomalies
        anomalies_data = MLService.run_anomaly_detection()
        
        # 5. Fetch insights
        insights_data = InsightService.generate_dashboard_insights()
        
        # 6. Build PDF
        PDFGenerator.build_pdf(
            output_path=output_path,
            data_profile=data_profile,
            forecast_data=forecast_data,
            classification_data=classification_data,
            anomalies_data=anomalies_data,
            insights_data=insights_data
        )
        
        # Return PDF
        if os.path.exists(output_path):
            return FileResponse(
                path=output_path,
                filename=report_filename,
                media_type="application/pdf"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Report creation completed but PDF file was not written."
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate executive report: {str(e)}"
        )
