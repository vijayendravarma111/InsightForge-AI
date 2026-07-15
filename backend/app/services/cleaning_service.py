import json
import pandas as pd
import numpy as np
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine
from app.core.exceptions import DataCleaningError
from app.services.profiling_service import ProfilingService

class CleaningService:
    @classmethod
    def get_cleaning_recommendations(cls, table_name: str) -> list:
        """Inspects table and returns a list of recommended cleaning tasks."""
        # Run profiling to gather statistics
        profile = ProfilingService.profile_table(table_name)
        
        recommendations = []
        
        # 1. Duplicates check
        if profile["duplicate_rows"] > 0:
            recommendations.append({
                "type": "remove_duplicates",
                "column": None,
                "message": f"{profile['duplicate_rows']} duplicate rows detected. Remove them?",
                "severity": "medium",
                "default_value": True
            })
            
        # 2. Missing values check
        for col, stats in profile["columns"].items():
            null_count = stats["null_count"]
            if null_count > 0:
                # Suggest median for numeric, mode for text
                impute_method = "median" if "INT" in stats["type"].upper() or "FLOAT" in stats["type"].upper() else "mode"
                recommendations.append({
                    "type": "fill_nulls",
                    "column": col,
                    "message": f"{null_count} missing values in '{col}'. Fill with {impute_method}?",
                    "severity": "high",
                    "default_value": True,
                    "parameters": {"method": impute_method}
                })
                
        # 3. Date inconsistent formatting check
        for col, stats in profile["columns"].items():
            if "date" in col.lower() or "time" in col.lower():
                # Check consistency
                consistency_pct = profile["quality_dimensions"]["consistency"]
                if consistency_pct < 100.0:
                    recommendations.append({
                        "type": "standardize_dates",
                        "column": col,
                        "message": f"Inconsistent date format found in '{col}'. Standardize to YYYY-MM-DD?",
                        "severity": "high",
                        "default_value": True
                    })
                    break # Usually one standardization recommendation for dates is enough
                    
        return recommendations

    @classmethod
    def apply_cleaning_rules(cls, table_name: str, rules: list, preview_only: bool = False) -> dict:
        """Applies a list of cleaning rules to the dataframe and saves it back (or previews)."""
        df = ProfilingService.get_table_dataframe(table_name)
        
        logs = []
        
        # Apply rules sequentially
        for rule in rules:
            rule_type = rule.get("type")
            col = rule.get("column")
            
            if rule_type == "remove_duplicates":
                before_len = len(df)
                df = df.drop_duplicates()
                after_len = len(df)
                logs.append(f"Dropped {before_len - after_len} duplicate rows.")
                
            elif rule_type == "fill_nulls" and col in df.columns:
                null_indices = df[df[col].isnull()].index
                if len(null_indices) > 0:
                    method = rule.get("parameters", {}).get("method", "median")
                    
                    if method == "mean":
                        fill_val = df[col].mean()
                        df[col] = df[col].fillna(fill_val)
                    elif method == "mode":
                        # Handle case where mode is empty
                        modes = df[col].mode()
                        fill_val = modes.iloc[0] if not modes.empty else "N/A"
                        df[col] = df[col].fillna(fill_val)
                    elif method == "median" or True: # Default to median
                        # Try to compute median, fallback to mode if string
                        try:
                            fill_val = df[col].median()
                        except Exception:
                            modes = df[col].mode()
                            fill_val = modes.iloc[0] if not modes.empty else "N/A"
                        df[col] = df[col].fillna(fill_val)
                        
                    logs.append(f"Filled {len(null_indices)} nulls in '{col}' using {method} (value: {fill_val}).")
                    
            elif rule_type == "standardize_dates" and col in df.columns:
                # Attempt to parse various date formats
                # Errors='coerce' maps unparseable to NaT. Then we fill with method forward fill or drop.
                before_nat = df[col].isna().sum()
                parsed_dates = pd.to_datetime(df[col], errors='coerce')
                
                # Format to standard YYYY-MM-DD
                df[col] = parsed_dates.dt.strftime('%Y-%m-%d')
                after_nat = df[col].isna().sum()
                
                # If standardization created new NaTs, forward-fill them to maintain integrity
                if after_nat > before_nat:
                    df[col] = df[col].ffill().bfill()
                
                logs.append(f"Standardized date formatting in '{col}' to YYYY-MM-DD.")

        # If not preview, write cleaned table back to DB (overwrite raw table)
        if not preview_only:
            try:
                # Write to database
                df.to_sql(
                    name=table_name,
                    con=engine,
                    schema=settings.RAW_SCHEMA,
                    if_exists='replace',
                    index=False,
                    method='multi',
                    chunksize=1000
                )
                
                # Save audit log to transformation_history
                with engine.begin() as conn:
                    conn.execute(
                        text(f"INSERT INTO transformation_history (dataset_name, operations) VALUES (:name, :ops)"),
                        {"name": table_name, "ops": json.dumps(rules)}
                    )
            except Exception as e:
                raise DataCleaningError(f"Failed to save cleaned data to database: {str(e)}")
                
        # Generate a small preview slice (first 50 rows) for UI display
        preview_data = df.head(50).replace({pd.NaT: None, np.nan: None}).to_dict(orient='records')
        
        return {
            "status": "success",
            "logs": logs,
            "row_count": len(df),
            "preview": preview_data
        }

    @classmethod
    def get_transformation_history(cls, table_name: str) -> list:
        """Fetches prior cleaning operations applied to this dataset."""
        query = text("SELECT operations, applied_at FROM transformation_history WHERE dataset_name = :name ORDER BY applied_at DESC")
        try:
            with engine.connect() as conn:
                results = conn.execute(query, {"name": table_name}).fetchall()
                return [
                    {
                        "operations": json.loads(row[0]) if isinstance(row[0], str) else row[0],
                        "applied_at": row[1].isoformat()
                    } for row in results
                ]
        except Exception:
            return []
