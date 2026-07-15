import os
import pandas as pd
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine
from app.core.exceptions import DataImportError, DataValidationError
from app.utils.data_seeder import seed_default_dataset_if_empty

class ImportService:
    @staticmethod
    def get_available_datasets() -> list:
        """Lists files in upload directory."""
        files = []
        if os.path.exists(settings.UPLOAD_DIR):
            for file in os.listdir(settings.UPLOAD_DIR):
                if file.endswith(('.csv', '.xlsx', '.xls')):
                    path = os.path.join(settings.UPLOAD_DIR, file)
                    stats = os.stat(path)
                    files.append({
                        "filename": file,
                        "size_bytes": stats.st_size,
                        "modified_at": stats.st_mtime
                    })
        return files

    @staticmethod
    def load_dataset_to_postgres(filename: str = None) -> dict:
        """Loads a file from upload_dir into the `raw_imports` schema in PostgreSQL."""
        # Seeding fallback
        if not filename:
            filename = "superstore_sales.csv"
            seed_default_dataset_if_empty(settings.UPLOAD_DIR)
            
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        if not os.path.exists(file_path):
            raise DataImportError(f"Dataset file '{filename}' not found.")
            
        # Parse file based on extension
        try:
            if filename.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(file_path)
            else:
                # Detect delimiter (comma, semicolon, tab)
                try:
                    df = pd.read_csv(file_path, nrows=5)
                    # Simple check: if there is only 1 column and contains tabs or semicolons
                    if len(df.columns) <= 1:
                        content = open(file_path, 'r').readline()
                        if ';' in content:
                            df = pd.read_csv(file_path, sep=';')
                        elif '\t' in content:
                            df = pd.read_csv(file_path, sep='\t')
                        else:
                            df = pd.read_csv(file_path)
                    else:
                        df = pd.read_csv(file_path)
                except Exception:
                    df = pd.read_csv(file_path)
        except Exception as e:
            raise DataImportError(f"Failed to read file: {str(e)}")
            
        if df.empty:
            raise DataValidationError("Uploaded dataset is empty.")

        # Data type inference & simple sanitization
        # Clean column names: replace spaces/dots with underscores, alphanumeric only
        cleaned_cols = {}
        for col in df.columns:
            cleaned_name = str(col).strip().replace(" ", "_").replace(".", "_").replace("-", "_").lower()
            cleaned_cols[col] = cleaned_name
            
        df = df.rename(columns=cleaned_cols)
        
        # Infer datatypes and format
        inferred_schema = {}
        for col in df.columns:
            # Drop nulls temporarily to inspect the underlying types
            non_nulls = df[col].dropna()
            if non_nulls.empty:
                inferred_schema[col] = "TEXT"
                continue
                
            first_val = non_nulls.iloc[0]
            if isinstance(first_val, (int, np.integer)):
                inferred_schema[col] = "INTEGER"
            elif isinstance(first_val, (float, np.floating)):
                inferred_schema[col] = "FLOAT"
            elif isinstance(first_val, (bool, np.bool_)):
                inferred_schema[col] = "BOOLEAN"
            else:
                # Check if it looks like a date
                try:
                    pd.to_datetime(non_nulls.head(10), errors='raise')
                    inferred_schema[col] = "TIMESTAMP"
                except Exception:
                    inferred_schema[col] = "TEXT"

        # Safe table name
        table_name = filename.split('.')[0].lower().replace(" ", "_").replace("-", "_")
        
        # Load into PostgreSQL raw_imports schema
        try:
            # Establish raw_imports schema
            with engine.begin() as conn:
                conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {settings.RAW_SCHEMA};"))
                # Drop existing table if exists
                conn.execute(text(f"DROP TABLE IF EXISTS {settings.RAW_SCHEMA}.{table_name};"))
                
            # Pandas to_sql handles table creation and insert
            df.to_sql(
                name=table_name,
                con=engine,
                schema=settings.RAW_SCHEMA,
                if_exists='replace',
                index=False,
                method='multi',
                chunksize=1000
            )
        except Exception as e:
            raise DataImportError(f"Database insertion failed: {str(e)}")
            
        return {
            "status": "success",
            "table_name": table_name,
            "row_count": len(df),
            "col_count": len(df.columns),
            "schema": inferred_schema
        }

    @staticmethod
    def save_upload(file_contents: bytes, filename: str) -> str:
        """Saves uploaded file bytes to storage folder."""
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        try:
            with open(file_path, "wb") as f:
                f.write(file_contents)
            return filename
        except Exception as e:
            raise DataImportError(f"Failed to write uploaded file to disk: {str(e)}")
            
import numpy as np # Import required by first_val checks
