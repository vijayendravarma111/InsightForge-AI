import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db
from app.core.exceptions import InsightForgeError, insightforge_exception_handler
from app.api import import_api, profiling, cleaning, etl, warehouse, analytics, dashboard, ml, report

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("InsightForge")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise Data Warehouse, Analytics Platform, & ML Engine",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(InsightForgeError, insightforge_exception_handler)

# Include API Routers
app.include_router(import_api.router, prefix=settings.API_V1_STR)
app.include_router(profiling.router, prefix=settings.API_V1_STR)
app.include_router(cleaning.router, prefix=settings.API_V1_STR)
app.include_router(etl.router, prefix=settings.API_V1_STR)
app.include_router(warehouse.router, prefix=settings.API_V1_STR)
app.include_router(analytics.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(ml.router, prefix=settings.API_V1_STR)
app.include_router(report.router, prefix=settings.API_V1_STR)

@app.on_event("startup")
def on_startup():
    logger.info("Initializing database schemas...")
    try:
        init_db()
        logger.info("Database initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}
