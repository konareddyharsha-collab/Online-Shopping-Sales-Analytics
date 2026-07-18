import os
import sqlite3
import random
from datetime import datetime, timedelta

def main():
    print("Generating synthetic database for Online Shopping Sales Analytics...")
    
    db_path = 'sales.db'
    if os.path.exists(db_path):
        os.remove(db_path)
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Create Tables
    cursor.execute("""
    CREATE TABLE customers (
        customer_id INTEGER PRIMARY KEY,
        customer_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        gender TEXT,
        age INTEGER,
        location TEXT,
        signup_date DATE
    );
    """)
    
    cursor.execute("""
    CREATE TABLE products (
        product_id INTEGER PRIMARY KEY,
        product_name TEXT NOT NULL,
        category TEXT NOT NULL,
        sub_category TEXT NOT NULL,
        price REAL NOT NULL,
        cost REAL NOT NULL,
        stock_quantity INTEGER NOT NULL
    );
    """)
    
    cursor.execute("""
    CREATE TABLE transactions (
        transaction_id INTEGER PRIMARY KEY,
        customer_id INTEGER,
        product_id INTEGER,
        transaction_date DATETIME,
        quantity INTEGER,
        unit_price REAL,
        discount REAL,
        total_amount REAL,
        payment_method TEXT,
        shipping_method TEXT,
        order_status TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (product_id) REFERENCES products(product_id)
    );
    """)
    
    # 2. Data Lists for Generation
    first_names_male = ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua"]
    first_names_female = ["Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen", "Lisa", "Nancy", "Betty", "Sandra", "Margaret", "Ashley", "Kimberly", "Emily", "Donna", "Michelle"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"]
    
    states = ["California", "Texas", "New York", "Florida", "Illinois", "Pennsylvania", "Ohio", "Georgia", "North Carolina", "Michigan", "Washington", "Colorado", "Massachusetts", "Arizona", "Virginia"]
    payment_methods = ["Credit Card", "PayPal", "Debit Card", "Crypto"]
    shipping_methods = ["Standard", "Express", "Next Day"]
    statuses = ["Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Completed", "Returned", "Cancelled", "Processing"] # 75% completed, 8.3% returned, cancelled, processing
    
    categories = {
        "Electronics": {
            "Phones": [("iPhone 15", 799, 550), ("Samsung Galaxy S24", 899, 620), ("Google Pixel 8", 699, 480), ("OnePlus 12", 799, 560)],
            "Laptops": [("MacBook Air M3", 1099, 750), ("Dell XPS 13", 1199, 830), ("Lenovo ThinkPad X1 Carbon", 1499, 1050), ("HP Spectre x360", 1299, 900)],
            "Accessories": [("Wireless Mouse", 29.99, 12), ("Mechanical Keyboard", 89.99, 45), ("USB-C Hub", 39.99, 15), ("Noise Cancelling Headphones", 249.99, 140)]
        },
        "Clothing": {
            "Men's Apparel": [("Men's Slim Fit Jeans", 49.99, 20), ("Men's Cotton T-Shirt", 19.99, 7), ("Men's Leather Jacket", 199.99, 90), ("Men's Running Shoes", 89.99, 40)],
            "Women's Apparel": [("Women's Summer Dress", 39.99, 16), ("Women's Activewear Leggings", 29.99, 11), ("Women's Trench Coat", 129.99, 60), ("Women's Running Shoes", 89.99, 40)],
            "Accessories": [("Leather Wallet", 34.99, 15), ("Polarized Sunglasses", 59.99, 22), ("Canvas Backpack", 45.00, 18)]
        },
        "Home & Kitchen": {
            "Kitchenware": [("Air Fryer XL", 119.99, 65), ("10-Piece Cookware Set", 149.99, 80), ("Electric Kettle", 34.99, 15), ("Chef Knife 8-inch", 49.99, 20)],
            "Bedding": [("Memory Foam Pillow", 39.99, 18), ("Queen Sheet Set", 59.99, 25), ("Down Comforter", 129.99, 60)],
            "Appliances": [("Robot Vacuum", 299.99, 170), ("Humidifier", 49.99, 20), ("Smart Thermostat", 199.99, 110)]
        },
        "Books": {
            "Fiction": [("The Great Gatsby", 12.99, 5), ("To Kill a Mockingbird", 14.99, 6), ("1984", 11.99, 4.5), ("The Hobbit", 15.99, 7)],
            "Non-Fiction": [("Sapiens", 19.99, 9), ("Thinking, Fast and Slow", 18.99, 8), ("Atomic Habits", 16.99, 7.5), ("Educated", 15.99, 6.5)],
            "Kids": [("Harry Potter Box Set", 79.99, 40), ("The Very Hungry Caterpillar", 9.99, 4), ("Where the Wild Things Are", 12.99, 5)]
        },
        "Beauty": {
            "Skincare": [("Vitamin C Serum", 24.99, 8), ("Moisturizing Cream", 19.99, 6), ("Sunscreen SPF 50", 14.99, 5), ("Exfoliating Scrub", 17.99, 6)],
            "Makeup": [("Matte Lipstick", 15.99, 4.5), ("Liquid Foundation", 29.99, 11), ("Mascara Black", 12.99, 4)],
            "Haircare": [("Shampoo & Conditioner Set", 27.99, 10), ("Hair Dryer Pro", 79.99, 40), ("Argan Hair Oil", 19.99, 7)]
        },
        "Sports & Outdoors": {
            "Fitness": [("Dumbbell Set 20lbs", 44.99, 22), ("Yoga Mat Non-Slip", 22.99, 9), ("Resistance Bands", 14.99, 5), ("Smart Fitness Tracker", 99.99, 55)],
            "Camping": [("4-Person Camping Tent", 119.99, 60), ("Sleeping Bag 0-Degree", 49.99, 22), ("Camping Stove", 29.99, 13)]
        }
    }
    
    # 3. Generate and Insert Customers (1,200 customers)
    print("Generating 1,200 customers...")
    customers_data = []
    start_date = datetime(2023, 1, 1)
    
    for c_id in range(1, 1201):
        gender = random.choice(["Male", "Female"])
        if gender == "Male":
            first_name = random.choice(first_names_male)
        else:
            first_name = random.choice(first_names_female)
        last_name = random.choice(last_names)
        name = f"{first_name} {last_name}"
        email = f"{first_name.lower()}.{last_name.lower()}.{c_id}@example-shopping.com"
        age = int(random.gauss(38, 12))  # bell curve centered around 38 years old
        age = max(18, min(80, age))     # bound between 18 and 80
        location = random.choice(states)
        
        # signup date between Jan 1, 2023 and Dec 31, 2024
        days_offset = random.randint(0, 729)
        signup_date = (start_date + timedelta(days=days_offset)).strftime("%Y-%m-%d")
        
        customers_data.append((c_id, name, email, gender, age, location, signup_date))
        
    cursor.executemany("INSERT INTO customers VALUES (?,?,?,?,?,?,?)", customers_data)
    
    # 4. Generate and Insert Products (Flatten categories list)
    print("Generating products catalog...")
    products_data = []
    p_id = 1
    for category, sub_cats in categories.items():
        for sub_category, items in sub_cats.items():
            for item_name, price, cost in items:
                stock = random.randint(10, 500)
                products_data.append((p_id, item_name, category, sub_category, price, cost, stock))
                p_id += 1
                
    cursor.executemany("INSERT INTO products VALUES (?,?,?,?,?,?,?)", products_data)
    
    # 5. Generate and Insert Transactions (22,000+ sales over Jan 1, 2024 to Dec 31, 2025)
    print("Generating 22,000+ sales transactions (over 2 years)...")
    transactions_data = []
    
    tx_start_date = datetime(2024, 1, 1, 0, 0, 0)
    total_days = 730 # 2 full years
    
    num_transactions = 22500
    
    for tx_id in range(1, num_transactions + 1):
        customer = random.choice(customers_data)
        cust_id = customer[0]
        cust_signup_str = customer[6]
        cust_signup = datetime.strptime(cust_signup_str, "%Y-%m-%d")
        
        product = random.choice(products_data)
        prod_id = product[0]
        prod_price = product[4]
        
        # Transaction date must be after customer sign up date
        # And let's skew dates to represent realistic trends:
        # - November & December have 1.8x transaction density (holiday shopping)
        # - Weekends (Fri, Sat, Sun) have 1.3x density
        # - Times: peak shopping is 18:00 - 22:00
        
        while True:
            # Random day in the 2-year range
            day_offset = random.randint(0, total_days - 1)
            tx_date = tx_start_date + timedelta(days=day_offset)
            
            # Check if transaction is after customer signup
            if tx_date >= cust_signup:
                # Calculate weights/probability of keeping this date
                weight = 1.0
                
                # Monthly seasonality
                if tx_date.month in [11, 12]:
                    weight *= 1.8
                elif tx_date.month in [1, 2]: # Post holiday drop
                    weight *= 0.7
                elif tx_date.month in [8, 9]: # Back to school
                    weight *= 1.2
                    
                # Weekly seasonality
                if tx_date.weekday() in [4, 5, 6]: # Fri, Sat, Sun
                    weight *= 1.3
                    
                # Apply random check against weight to accept/reject date
                if random.random() < (weight / 2.0):
                    # Set time of day
                    # Beta distribution or custom distribution for hours
                    # Peak at 19:00 (7 PM), minimum at 03:00 AM
                    hour_rand = random.random()
                    if hour_rand < 0.1: # 00:00 - 06:00 (quiet)
                        hour = random.randint(0, 5)
                    elif hour_rand < 0.3: # 06:00 - 12:00 (morning rising)
                        hour = random.randint(6, 11)
                    elif hour_rand < 0.65: # 12:00 - 18:00 (afternoon)
                        hour = random.randint(12, 17)
                    else: # 18:00 - 24:00 (evening peak)
                        hour = random.randint(18, 23)
                        
                    minute = random.randint(0, 59)
                    second = random.randint(0, 59)
                    tx_date = tx_date.replace(hour=hour, minute=minute, second=second)
                    break
        
        # Quantity (mostly 1, less 2, rarely 3-5)
        quantity = random.choices([1, 2, 3, 4, 5], weights=[70, 20, 6, 3, 1])[0]
        
        # Discount policy
        # 0% discount (72%), 5% (8%), 10% (10%), 20% (7%), 30% (3%)
        discount = random.choices([0.0, 0.05, 0.10, 0.20, 0.30], weights=[72, 8, 10, 7, 3])[0]
        
        # Calculations
        raw_amount = quantity * prod_price
        total_amount = round(raw_amount * (1.0 - discount), 2)
        
        payment = random.choice(payment_methods)
        shipping = random.choice(shipping_methods)
        status = random.choice(statuses)
        
        transactions_data.append((
            tx_id,
            cust_id,
            prod_id,
            tx_date.strftime("%Y-%m-%d %H:%M:%S"),
            quantity,
            prod_price,
            discount,
            total_amount,
            payment,
            shipping,
            status
        ))
        
    cursor.executemany("INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?,?,?,?)", transactions_data)
    
    conn.commit()
    print(f"Successfully generated database! SQLite file '{db_path}' contains:")
    print(f"  - {len(customers_data)} Customers")
    print(f"  - {len(products_data)} Products")
    print(f"  - {len(transactions_data)} Transactions")
    
    # 6. Generate MySQL-compatible dump SQL file
    print("Writing MySQL-compatible dump file 'online_shopping_sales.sql'...")
    sql_dump_path = 'online_shopping_sales.sql'
    with open(sql_dump_path, 'w', encoding='utf-8') as f:
        f.write("-- ====================================================================\n")
        f.write("-- ONLINE SHOPPING SALES ANALYTICS DATABASE DUMP\n")
        f.write(f"-- Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("-- Records: 22,000+ transactions, 1,200 customers, 42 products\n")
        f.write("-- Optimized for MySQL\n")
        f.write("-- ====================================================================\n\n")
        
        f.write("CREATE DATABASE IF NOT EXISTS online_shopping_sales;\n")
        f.write("USE online_shopping_sales;\n\n")
        
        f.write("DROP TABLE IF EXISTS transactions;\n")
        f.write("DROP TABLE IF EXISTS products;\n")
        f.write("DROP TABLE IF EXISTS customers;\n\n")
        
        # Customers Table
        f.write("""CREATE TABLE customers (
    customer_id INT PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    gender VARCHAR(10),
    age INT,
    location VARCHAR(100),
    signup_date DATE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n""")
        
        # Products Table
        f.write("""CREATE TABLE products (
    product_id INT PRIMARY KEY,
    product_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    sub_category VARCHAR(50) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    cost DECIMAL(10, 2) NOT NULL,
    stock_quantity INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n""")
        
        # Transactions Table
        f.write("""CREATE TABLE transactions (
    transaction_id INT PRIMARY KEY,
    customer_id INT,
    product_id INT,
    transaction_date DATETIME,
    quantity INT,
    unit_price DECIMAL(10, 2),
    discount DECIMAL(3, 2),
    total_amount DECIMAL(10, 2),
    payment_method VARCHAR(30),
    shipping_method VARCHAR(30),
    order_status VARCHAR(20),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n""")

        # Writing customers insertions
        f.write("-- Populating customers table\n")
        f.write("INSERT INTO customers (customer_id, customer_name, email, gender, age, location, signup_date) VALUES \n")
        cust_rows = []
        for row in customers_data:
            name_esc = row[1].replace("'", "''")
            email_esc = row[2].replace("'", "''")
            cust_rows.append(f"({row[0]}, '{name_esc}', '{email_esc}', '{row[3]}', {row[4]}, '{row[5]}', '{row[6]}')")
        f.write(",\n".join(cust_rows) + ";\n\n")
        
        # Writing products insertions
        f.write("-- Populating products table\n")
        f.write("INSERT INTO products (product_id, product_name, category, sub_category, price, cost, stock_quantity) VALUES \n")
        prod_rows = []
        for row in products_data:
            name_esc = row[1].replace("'", "''")
            prod_rows.append(f"({row[0]}, '{name_esc}', '{row[2]}', '{row[3]}', {row[4]}, {row[5]}, {row[6]})")
        f.write(",\n".join(prod_rows) + ";\n\n")
        
        # Writing transactions insertions in chunks of 500 records to prevent buffer issues
        f.write("-- Populating transactions table\n")
        chunk_size = 500
        for i in range(0, len(transactions_data), chunk_size):
            chunk = transactions_data[i:i+chunk_size]
            f.write("INSERT INTO transactions (transaction_id, customer_id, product_id, transaction_date, quantity, unit_price, discount, total_amount, payment_method, shipping_method, order_status) VALUES \n")
            tx_rows = []
            for row in chunk:
                tx_rows.append(f"({row[0]}, {row[1]}, {row[2]}, '{row[3]}', {row[4]}, {row[5]}, {row[6]}, {row[7]}, '{row[8]}', '{row[9]}', '{row[10]}')")
            f.write(",\n".join(tx_rows) + ";\n\n")
            
    print(f"Successfully created MySQL dump file '{sql_dump_path}'")
    conn.close()

if __name__ == '__main__':
    main()
