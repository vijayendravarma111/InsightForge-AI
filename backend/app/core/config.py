import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "InsightForge AI"
    API_V1_STR: str = "/api"
    
    # PostgreSQL Configuration
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "insightforge")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Data Uploads Configuration
    UPLOAD_DIR: str = os.path.join(os.getcwd(), "data_store", "uploads")
    CLEANED_DIR: str = os.path.join(os.getcwd(), "data_store", "cleaned")
    REPORT_DIR: str = os.path.join(os.getcwd(), "data_store", "reports")
    
    # Schema configuration
    RAW_SCHEMA: str = "raw_imports"
    DW_SCHEMA: str = "warehouse"

    class Config:
        case_sensitive = True

settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.CLEANED_DIR, exist_ok=True)
os.makedirs(settings.REPORT_DIR, exist_ok=True)
