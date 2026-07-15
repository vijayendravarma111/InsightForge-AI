import json
from datetime import datetime
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine, normalize_column_casing
from app.core.exceptions import ETLExecutionError
from app.services.cleaning_service import CleaningService
from app.services.profiling_service import ProfilingService

class ETLService:
    @classmethod
    def execute_pipeline(cls, table_name: str) -> dict:
        """Executes the automated ETL pipeline:
        1. Initialize logs
        2. Clean raw table (automatically apply recommendations)
        3. Extract dimensions (Customers, Products, Geography, Time)
        4. Populate fact_sales
        5. Finalize status logs
        """
        pipeline_name = f"ETL Pipeline ({table_name})"
        
        # 1. Initialize Log row
        log_id = cls._create_log_entry(pipeline_name, "STARTING", [])
        steps = []
        
        try:
            # Auto-normalize column casing to lowercase for database safety
            normalize_column_casing()
            
            # Step 1: Ingestion validation
            steps.append({"step": "Validate Raw Schema", "status": "COMPLETED", "timestamp": datetime.now().isoformat()})
            cls._update_log_status(log_id, "RUNNING", steps)
            
            # Step 2: Auto-Clean
            steps.append({"step": "Run Recommendations & Auto-Clean", "status": "IN_PROGRESS", "timestamp": datetime.now().isoformat()})
            cls._update_log_status(log_id, "RUNNING", steps)
            
            # Auto-generate cleaning rules and apply them
            recs = CleaningService.get_cleaning_recommendations(table_name)
            clean_res = CleaningService.apply_cleaning_rules(table_name, recs, preview_only=False)
            
            steps[-1]["status"] = "COMPLETED"
            steps[-1]["logs"] = clean_res["logs"]
            cls._update_log_status(log_id, "RUNNING", steps)
            
            # Step 3: Populate dimensions in PostgreSQL Warehouse
            steps.append({"step": "Generate Star Schema Dimensions", "status": "IN_PROGRESS", "timestamp": datetime.now().isoformat()})
            cls._update_log_status(log_id, "RUNNING", steps)
            
            cls._build_warehouse_dimensions(table_name)
            
            steps[-1]["status"] = "COMPLETED"
            cls._update_log_status(log_id, "RUNNING", steps)
            
            # Step 4: Populate fact table
            steps.append({"step": "Populate Fact Sales", "status": "IN_PROGRESS", "timestamp": datetime.now().isoformat()})
            cls._update_log_status(log_id, "RUNNING", steps)
            
            cls._build_warehouse_facts(table_name)
            
            steps[-1]["status"] = "COMPLETED"
            cls._update_log_status(log_id, "RUNNING", steps)
            
            # Step 5: Finalized
            cls._update_log_status(log_id, "COMPLETED", steps)
            
        except Exception as e:
            steps.append({"step": "ETL Pipeline Failed", "status": "FAILED", "error": str(e), "timestamp": datetime.now().isoformat()})
            cls._update_log_status(log_id, "FAILED", steps)
            raise ETLExecutionError(f"ETL execution aborted: {str(e)}")
            
        return {
            "status": "success",
            "pipeline_logs": steps
        }

    @staticmethod
    def _create_log_entry(name: str, status: str, steps: list) -> int:
        query = text("""
            INSERT INTO etl_pipeline_logs (pipeline_name, status, steps_completed, started_at)
            VALUES (:name, :status, :steps, CURRENT_TIMESTAMP)
            RETURNING id
        """)
        with engine.begin() as conn:
            result = conn.execute(query, {"name": name, "status": status, "steps": json.dumps(steps)}).fetchone()
            return result[0]

    @staticmethod
    def _update_log_status(log_id: int, status: str, steps: list):
        query = text("""
            UPDATE etl_pipeline_logs
            SET status = :status, steps_completed = :steps, completed_at = CASE WHEN :status IN ('COMPLETED', 'FAILED') THEN CURRENT_TIMESTAMP ELSE NULL END
            WHERE id = :id
        """)
        with engine.begin() as conn:
            conn.execute(query, {"id": log_id, "status": status, "steps": json.dumps(steps)})

    @staticmethod
    def _build_warehouse_dimensions(table_name: str):
        """Constructs dimension tables in PostgreSQL 'warehouse' schema."""
        raw_tbl = f"{settings.RAW_SCHEMA}.{table_name}"
        dw = settings.DW_SCHEMA
        
        with engine.begin() as conn:
            # 1. Dimension: dim_products
            conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {dw}.dim_products (
                    product_key SERIAL PRIMARY KEY,
                    product_id VARCHAR(100) UNIQUE,
                    product_name VARCHAR(255),
                    category VARCHAR(100),
                    sub_category VARCHAR(100)
                );
            """))
            # Insert distinct products from raw
            conn.execute(text(f"""
                INSERT INTO {dw}.dim_products (product_id, product_name, category, sub_category)
                SELECT DISTINCT product_id, product_name, category, sub_category
                FROM {raw_tbl}
                WHERE product_id IS NOT NULL
                ON CONFLICT (product_id) DO UPDATE SET
                    product_name = EXCLUDED.product_name,
                    category = EXCLUDED.category,
                    sub_category = EXCLUDED.sub_category;
            """))

            # 2. Dimension: dim_geography
            conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {dw}.dim_geography (
                    geo_key SERIAL PRIMARY KEY,
                    city VARCHAR(100),
                    state VARCHAR(100),
                    region VARCHAR(100),
                    country VARCHAR(100),
                    UNIQUE (city, state, region, country)
                );
            """))
            conn.execute(text(f"""
                INSERT INTO {dw}.dim_geography (city, state, region, country)
                SELECT DISTINCT city, state, region, country
                FROM {raw_tbl}
                WHERE city IS NOT NULL AND state IS NOT NULL
                ON CONFLICT DO NOTHING;
            """))

            # 3. Dimension: dim_time
            conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {dw}.dim_time (
                    date_key INTEGER PRIMARY KEY,
                    full_date DATE UNIQUE,
                    year INTEGER,
                    quarter INTEGER,
                    month INTEGER,
                    day INTEGER
                );
            """))
            # Generate date dimension rows using date fields in raw (combining order date and ship date)
            conn.execute(text(f"""
                INSERT INTO {dw}.dim_time (date_key, full_date, year, quarter, month, day)
                SELECT DISTINCT
                    CAST(REPLACE(order_date, '-', '') AS INTEGER) as date_key,
                    CAST(order_date AS DATE) as full_date,
                    EXTRACT(YEAR FROM CAST(order_date AS DATE)) as year,
                    EXTRACT(QUARTER FROM CAST(order_date AS DATE)) as quarter,
                    EXTRACT(MONTH FROM CAST(order_date AS DATE)) as month,
                    EXTRACT(DAY FROM CAST(order_date AS DATE)) as day
                FROM {raw_tbl}
                WHERE order_date IS NOT NULL AND order_date ~ '^\d{{4}}-\d{{2}}-\d{{2}}$'
                ON CONFLICT DO NOTHING;
            """))
            
            # 4. Dimension: dim_customers with computed RFM analytics (Recency, Frequency, Monetary)
            conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {dw}.dim_customers (
                    customer_key SERIAL PRIMARY KEY,
                    customer_id VARCHAR(100) UNIQUE,
                    customer_name VARCHAR(255),
                    segment VARCHAR(100),
                    recency_days INTEGER DEFAULT 0,
                    frequency INTEGER DEFAULT 0,
                    monetary_value NUMERIC(12,2) DEFAULT 0,
                    rfm_score INTEGER DEFAULT 0,
                    customer_tier VARCHAR(50) DEFAULT 'Standard'
                );
            """))
            
            # Initial customer insert
            conn.execute(text(f"""
                INSERT INTO {dw}.dim_customers (customer_id, customer_name, segment)
                SELECT DISTINCT customer_id, customer_name, segment
                FROM {raw_tbl}
                WHERE customer_id IS NOT NULL
                ON CONFLICT (customer_id) DO UPDATE SET
                    customer_name = EXCLUDED.customer_name,
                    segment = EXCLUDED.segment;
            """))
            
            # Calculate RFM statistics
            # Max date to calculate recency against
            max_date_res = conn.execute(text(f"SELECT MAX(CAST(order_date AS DATE)) FROM {raw_tbl} WHERE order_date ~ '^\d{{4}}-\d{{2}}-\d{{2}}$'")).fetchone()
            max_date = max_date_res[0] if max_date_res[0] else datetime.now().date()
            
            # Temporary customer RFM stats aggregation
            rfm_query = text(f"""
                WITH rfm_stats AS (
                    SELECT 
                        customer_id,
                        (:max_date - MAX(CAST(order_date AS DATE))) as recency,
                        COUNT(DISTINCT order_id) as frequency,
                        SUM(COALESCE(sales, 0)) as monetary
                    FROM {raw_tbl}
                    WHERE order_date ~ '^\d{{4}}-\d{{2}}-\d{{2}}$' AND customer_id IS NOT NULL
                    GROUP BY customer_id
                ),
                rfm_ntiles AS (
                    SELECT 
                        customer_id,
                        recency,
                        frequency,
                        monetary,
                        -- NTILE assigns scores 1 to 5. Note for recency, smaller value is better (lower days).
                        NTILE(5) OVER (ORDER BY recency DESC) as r_score, 
                        NTILE(5) OVER (ORDER BY frequency ASC) as f_score,
                        NTILE(5) OVER (ORDER BY monetary ASC) as m_score
                    FROM rfm_stats
                )
                SELECT 
                    customer_id,
                    recency,
                    frequency,
                    monetary,
                    (r_score + f_score + m_score) as rfm_sum
                FROM rfm_ntiles
            """)
            
            customer_rfm_records = conn.execute(rfm_query, {"max_date": max_date}).fetchall()
            
            # Update dim_customers with computed RFM
            for row in customer_rfm_records:
                cust_id, rec, freq, mon, rfm_score = row
                # Define tier based on score
                tier = "Platinum" if rfm_score >= 12 else "Gold" if rfm_score >= 8 else "Standard"
                
                conn.execute(text(f"""
                    UPDATE {dw}.dim_customers
                    SET recency_days = :rec,
                        frequency = :freq,
                        monetary_value = :mon,
                        rfm_score = :score,
                        customer_tier = :tier
                    WHERE customer_id = :id
                """), {
                    "rec": int(rec) if rec is not None else 0,
                    "freq": freq,
                    "mon": mon,
                    "score": rfm_score,
                    "tier": tier,
                    "id": cust_id
                })

    @staticmethod
    def _build_warehouse_facts(table_name: str):
        """Constructs fact_sales table connecting dimensions."""
        raw_tbl = f"{settings.RAW_SCHEMA}.{table_name}"
        dw = settings.DW_SCHEMA
        
        with engine.begin() as conn:
            # Drop existing fact sales if table exists to overwrite
            conn.execute(text(f"DROP TABLE IF EXISTS {dw}.fact_sales;"))
            
            conn.execute(text(f"""
                CREATE TABLE {dw}.fact_sales (
                    fact_key SERIAL PRIMARY KEY,
                    order_id VARCHAR(100),
                    customer_key INTEGER REFERENCES {dw}.dim_customers(customer_key),
                    product_key INTEGER REFERENCES {dw}.dim_products(product_key),
                    geo_key INTEGER REFERENCES {dw}.dim_geography(geo_key),
                    date_key INTEGER REFERENCES {dw}.dim_time(date_key),
                    sales NUMERIC(12,2),
                    quantity INTEGER,
                    discount NUMERIC(5,2),
                    profit NUMERIC(12,2)
                );
            """))
            
            # Populate facts with proper JOIN lookups
            conn.execute(text(f"""
                INSERT INTO {dw}.fact_sales (order_id, customer_key, product_key, geo_key, date_key, sales, quantity, discount, profit)
                SELECT 
                    r.order_id,
                    c.customer_key,
                    p.product_key,
                    g.geo_key,
                    CAST(REPLACE(r.order_date, '-', '') AS INTEGER) as date_key,
                    CAST(r.sales AS NUMERIC(12,2)),
                    CAST(r.quantity AS INTEGER),
                    CAST(r.discount AS NUMERIC(5,2)),
                    CAST(r.profit AS NUMERIC(12,2))
                FROM {raw_tbl} r
                JOIN {dw}.dim_customers c ON r.customer_id = c.customer_id
                JOIN {dw}.dim_products p ON r.product_id = p.product_id
                JOIN {dw}.dim_geography g ON r.city = g.city AND r.state = g.state AND r.region = g.region AND r.country = g.country
                WHERE r.order_date IS NOT NULL AND r.order_date ~ '^\d{{4}}-\d{{2}}-\d{{2}}$';
            """))

    @staticmethod
    def get_pipeline_logs() -> list:
        """Retrieves pipeline history execution logs."""
        query = text("SELECT id, pipeline_name, status, steps_completed, started_at, completed_at FROM etl_pipeline_logs ORDER BY started_at DESC")
        try:
            with engine.connect() as conn:
                results = conn.execute(query).fetchall()
                return [
                    {
                        "id": row[0],
                        "pipeline_name": row[1],
                        "status": row[2],
                        "steps": json.loads(row[3]) if isinstance(row[3], str) else row[3],
                        "started_at": row[4].isoformat() if row[4] else None,
                        "completed_at": row[5].isoformat() if row[5] else None
                    } for row in results
                ]
        except Exception:
            return []
