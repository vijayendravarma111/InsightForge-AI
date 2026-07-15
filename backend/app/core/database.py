import duckdb
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Create PostgreSQL engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base
Base = declarative_base()

def get_db():
    """PostgreSQL session dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_duckdb_conn():
    """Returns a local in-memory DuckDB connection.
    
    DuckDB can query pandas dataframes in the same thread automatically.
    """
    conn = duckdb.connect(database=":memory:")
    return conn

def normalize_column_casing():
    """Converts all columns in all tables of the raw_imports schema to lowercase."""
    try:
        with engine.connect() as conn:
            tables_res = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'raw_imports' AND table_type = 'BASE TABLE';
            """)).fetchall()
            
            for t_row in tables_res:
                table_name = t_row[0]
                cols_res = conn.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'raw_imports' AND table_name = :tbl;
                """), {"tbl": table_name}).fetchall()
                
                for c_row in cols_res:
                    col_name = c_row[0]
                    lower_col = col_name.lower()
                    if col_name != lower_col:
                        with engine.begin() as alter_conn:
                            alter_conn.execute(text(f'ALTER TABLE raw_imports."{table_name}" RENAME COLUMN "{col_name}" TO "{lower_col}";'))
    except Exception as e:
        import logging
        logging.getLogger("InsightForge").warning(f"Could not normalize raw column casing: {str(e)}")

def init_db():
    """Initializes schemas and base tables in PostgreSQL."""
    with engine.begin() as conn:
        # Create raw import and warehouse schemas
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {settings.RAW_SCHEMA};"))
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {settings.DW_SCHEMA};"))
        
        # Create ETL logs table
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS etl_pipeline_logs (
                id SERIAL PRIMARY KEY,
                pipeline_name VARCHAR(255) DEFAULT 'Superstore ETL',
                status VARCHAR(50) NOT NULL,
                steps_completed JSONB NOT NULL,
                started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE
            );
        """))
        
        # Create transformation history table
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS transformation_history (
                id SERIAL PRIMARY KEY,
                dataset_name VARCHAR(255) NOT NULL,
                operations JSONB NOT NULL,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))
        
    # Run casing normalization
    normalize_column_casing()
