import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def generate_superstore_dataset(num_rows: int = 2500) -> pd.DataFrame:
    """Generates a realistic synthetic Superstore Sales dataset for seeding,
    containing natural variations, some duplicates, missing values, date format issues,
    and outliers for profiling/cleaning demonstration.
    """
    np.random.seed(42)
    random.seed(42)
    
    # Base lists
    segments = ['Consumer', 'Corporate', 'Home Office']
    ship_modes = ['Standard Class', 'Second Class', 'First Class', 'Same Day']
    regions = ['East', 'West', 'Central', 'South']
    
    cities_by_region = {
        'East': [('New York City', 'New York'), ('Philadelphia', 'Pennsylvania'), ('Boston', 'Massachusetts'), ('Newark', 'New Jersey')],
        'West': [('Los Angeles', 'California'), ('San Francisco', 'California'), ('Seattle', 'Washington'), ('Denver', 'Colorado')],
        'Central': [('Chicago', 'Illinois'), ('Detroit', 'Michigan'), ('Houston', 'Texas'), ('Minneapolis', 'Minnesota')],
        'South': [('Atlanta', 'Georgia'), ('Miami', 'Florida'), ('Houston', 'Texas'), ('Henderson', 'Kentucky')]
    }
    
    categories = {
        'Furniture': ['Chairs', 'Tables', 'Bookcases', 'Furnishings'],
        'Office Supplies': ['Paper', 'Binders', 'Art', 'Fasteners', 'Envelopes', 'Appliances'],
        'Technology': ['Phones', 'Accessories', 'Copiers', 'Machines']
    }
    
    product_names = {
        'Chairs': ['HON 5400 Series Task Chair', 'Global Ergonomic Folding Chair', 'Harbour Executive Mesh Chair'],
        'Tables': ['Bush Somerset Conference Table', 'Bevis Round Conference Table', 'Bienna Utility Table'],
        'Bookcases': ['Bush Somerset Bookcase', 'Atlantic Metal Bookcase', 'Sauder 5-Shelf Bookcase'],
        'Furnishings': ['Eldon Cleat Cushion Desk Sheet', 'Staples Anti-Fatigue Mat', 'Howard Miller Wall Clock'],
        'Paper': ['Xerox 1980 Premium Paper', 'Staples Multifunctional Copy Paper', 'Laser Jet Recycled Paper'],
        'Binders': ['Wilson Jones Ring Binder', 'Avery Durable Binder', 'GBC Standard Comb Bindings'],
        'Art': ['Boston Pencil Sharpener', 'Crayola Washable Markers', 'Dixon Ticonderoga Pencils'],
        'Fasteners': ['Staples Paper Clips', 'Ideal Clamp Fasteners', 'Assorted Rubber Bands'],
        'Envelopes': ['Mead Self-Seal Envelopes', 'Kraft Kraft Envelopes', 'Security Tint Envelopes'],
        'Appliances': ['Hoover WindTunnel Vacuum', 'Krups Electric Coffee Maker', 'Avanti Compact Refrigerator'],
        'Phones': ['iPhone 14 Pro Max', 'Samsung Galaxy S23 Ultra', 'Adtran IP Phone'],
        'Accessories': ['Logitech Wireless Mouse', 'SanDisk 128GB Flash Drive', 'Verbatim DVD-R Media'],
        'Copiers': ['Canon ImageCLASS Copier', 'Hewlett Packard LaserJet Copier', 'Brother Digital Copier'],
        'Machines': ['Star Micronics Receipt Printer', 'Lexmark Dot Matrix Printer', 'Okidata Page Printer']
    }
    
    # Generate Customers
    customer_pool = []
    first_names = ['Claire', 'Darrin', 'Sean', 'Brosina', 'Irene', 'Harold', 'Pete', 'Alejandro', 'Zuschlich', 'Ken']
    last_names = ['Gute', 'Van Huff', 'O\'Donnell', 'Hoffman', 'Maddox', 'Pawlan', 'Armstrong', 'Grove', 'Zanderman', 'Lonsdale']
    
    for i in range(150):
        c_id = f"{random.choice(['CG', 'DV', 'SO', 'BH', 'IM', 'HP', 'PA', 'AG', 'ZZ', 'KL'])}-{10000 + i}"
        c_name = f"{random.choice(first_names)} {random.choice(last_names)}"
        segment = random.choice(segments)
        customer_pool.append((c_id, c_name, segment))
        
    # Generate Products
    product_pool = []
    for cat, subcats in categories.items():
        for subcat in subcats:
            names = product_names[subcat]
            for idx, name in enumerate(names):
                p_id = f"{cat[:3].upper()}-{subcat[:2].upper()}-{10000000 + idx + random.randint(1, 1000)}"
                product_pool.append((p_id, cat, subcat, name))
                
    # Generate rows
    rows = []
    start_date = datetime(2023, 1, 1)
    
    for i in range(num_rows):
        row_id = i + 1
        
        # Customer & Product choice
        cust_id, cust_name, segment = random.choice(customer_pool)
        prod_id, category, subcategory, prod_name = random.choice(product_pool)
        
        # Region & City choice
        region = random.choice(regions)
        city, state = random.choice(cities_by_region[region])
        
        # Order Date
        days_offset = random.randint(0, 1100)
        order_date = start_date + timedelta(days=days_offset)
        
        # Ship Mode & Ship Date
        ship_mode = random.choice(ship_modes)
        ship_days = 0 if ship_mode == 'Same Day' else random.choice([1, 2]) if ship_mode == 'First Class' else random.choice([3, 4])
        ship_date = order_date + timedelta(days=ship_days)
        
        # Sales, Quantity, Discount, Profit calculations
        qty = random.choice([1, 2, 3, 4, 5, 7, 9])
        
        # Base pricing
        base_prices = {'Furniture': 150.0, 'Office Supplies': 15.0, 'Technology': 250.0}
        base_price = base_prices[category] * random.uniform(0.5, 2.5)
        sales = round(base_price * qty, 2)
        
        # Discount (0.0 to 0.4 usually, sometimes 0.8)
        discount = random.choice([0.0, 0.0, 0.0, 0.1, 0.2, 0.2, 0.4, 0.8]) if category == 'Furniture' else random.choice([0.0, 0.0, 0.0, 0.0, 0.2, 0.2])
        sales = round(sales * (1.0 - discount), 2)
        
        # Profit Margin (normally 10% - 40%, unless high discount)
        cost_ratio = random.uniform(0.55, 0.75)
        cost = base_price * qty * cost_ratio
        profit = round(sales - cost, 2)
        
        # Create Order ID
        year_str = order_date.year
        order_id = f"CA-{year_str}-{random.randint(100000, 999999)}"
        
        rows.append({
            'Row ID': row_id,
            'Order ID': order_id,
            'Order Date': order_date.strftime('%Y-%m-%d'),
            'Ship Date': ship_date.strftime('%Y-%m-%d'),
            'Ship Mode': ship_mode,
            'Customer ID': cust_id,
            'Customer Name': cust_name,
            'Segment': segment,
            'Country': 'United States',
            'City': city,
            'State': state,
            'Region': region,
            'Product ID': prod_id,
            'Category': category,
            'Sub-Category': subcategory,
            'Product Name': prod_name,
            'Sales': sales,
            'Quantity': qty,
            'Discount': discount,
            'Profit': profit
        })
        
    df = pd.DataFrame(rows)
    
    # ----------------------------------------------------
    # Inject synthetic issues for Profiling/Cleaning demo
    # ----------------------------------------------------
    
    # 1. Duplicates: Append exactly 25 duplicate rows
    dupes = df.sample(n=25, random_state=42).copy()
    df = pd.concat([df, dupes], ignore_index=True)
    
    # 2. Missing values: Add ~3% missing values in 'Sales' and 'Profit'
    sales_null_indices = df.sample(frac=0.03, random_state=101).index
    df.loc[sales_null_indices, 'Sales'] = np.nan
    
    profit_null_indices = df.sample(frac=0.02, random_state=202).index
    df.loc[profit_null_indices, 'Profit'] = np.nan
    
    # 3. Inconsistent Date Formats: convert ~5% of 'Order Date' into dynamic formats (e.g. YYYY/MM/DD, DD-MM-YYYY)
    date_inconsistent_indices = df.sample(frac=0.04, random_state=303).index
    for idx in date_inconsistent_indices:
        dt = datetime.strptime(df.loc[idx, 'Order Date'], '%Y-%m-%d')
        if idx % 2 == 0:
            df.loc[idx, 'Order Date'] = dt.strftime('%Y/%m/%d')
        else:
            df.loc[idx, 'Order Date'] = dt.strftime('%d-%m-%Y')
            
    # 4. Outliers: Inject some extreme values for outlier checks
    outlier_indices = df.sample(n=10, random_state=404).index
    df.loc[outlier_indices, 'Sales'] = df.loc[outlier_indices, 'Sales'] * 15.0
    df.loc[outlier_indices, 'Profit'] = df.loc[outlier_indices, 'Profit'] * -12.0
    
    # Reset indices
    df = df.reset_index(drop=True)
    
    return df

def seed_default_dataset_if_empty(upload_dir: str) -> str:
    """Seeds the default superstore csv if it doesn't exist."""
    os.makedirs(upload_dir, exist_ok=True)
    target_path = os.path.join(upload_dir, "superstore_sales.csv")
    if not os.path.exists(target_path):
        df = generate_superstore_dataset()
        df.to_csv(target_path, index=False)
    return target_path
