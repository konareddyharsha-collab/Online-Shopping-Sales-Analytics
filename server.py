import os
import sys
import sqlite3
import json
import time
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8000
DB_FILE = "sales.db"

# Predefined queries dictionary matching queries.sql
QUERIES = {
    "kpis": {
        "title": "Core KPI Summary",
        "description": "Calculates total orders, total items sold, total revenue, total cost, net profit, and average profit margin for completed orders.",
        "sql": """
            SELECT 
                COUNT(DISTINCT t.transaction_id) AS total_orders,
                SUM(t.quantity) AS total_items_sold,
                ROUND(SUM(t.total_amount), 2) AS total_revenue,
                ROUND(SUM(t.quantity * p.cost), 2) AS total_cost,
                ROUND(SUM(t.total_amount - (t.quantity * p.cost)), 2) AS total_profit,
                ROUND((SUM(t.total_amount - (t.quantity * p.cost)) / SUM(t.total_amount)) * 100, 2) AS average_profit_margin_pct
            FROM transactions t
            JOIN products p ON t.product_id = p.product_id
            WHERE t.order_status = 'Completed';
        """
    },
    "trends": {
        "title": "Monthly Revenue & Profit Trends",
        "description": "Aggregates revenue, profit, and order count by month to track growth trends and seasonality.",
        "sql": """
            SELECT 
                strftime('%Y-%m', t.transaction_date) AS month,
                COUNT(t.transaction_id) AS order_count,
                ROUND(SUM(t.total_amount), 2) AS monthly_revenue,
                ROUND(SUM(t.total_amount - (t.quantity * p.cost)), 2) AS monthly_profit
            FROM transactions t
            JOIN products p ON t.product_id = p.product_id
            WHERE t.order_status = 'Completed'
            GROUP BY month
            ORDER BY month ASC;
        """
    },
    "categories": {
        "title": "Category Performance",
        "description": "Ranks product categories by unit volume, revenue, profit, and profit margin.",
        "sql": """
            SELECT 
                p.category,
                COUNT(DISTINCT p.product_id) AS unique_products_sold,
                SUM(t.quantity) AS total_quantity,
                ROUND(SUM(t.total_amount), 2) AS total_revenue,
                ROUND(SUM(t.total_amount - (t.quantity * p.cost)), 2) AS total_profit,
                ROUND((SUM(t.total_amount - (t.quantity * p.cost)) / SUM(t.total_amount)) * 100, 2) AS profit_margin_pct
            FROM transactions t
            JOIN products p ON t.product_id = p.product_id
            WHERE t.order_status = 'Completed'
            GROUP BY p.category
            ORDER BY total_revenue DESC;
        """
    },
    "top_products": {
        "title": "Top 10 Selling Products",
        "description": "Finds the top 10 products based on total sales revenue.",
        "sql": """
            SELECT 
                p.product_id,
                p.product_name,
                p.category,
                SUM(t.quantity) AS total_quantity_sold,
                ROUND(SUM(t.total_amount), 2) AS total_revenue,
                ROUND(SUM(t.total_amount - (t.quantity * p.cost)), 2) AS total_profit
            FROM transactions t
            JOIN products p ON t.product_id = p.product_id
            WHERE t.order_status = 'Completed'
            GROUP BY p.product_id, p.product_name, p.category
            ORDER BY total_revenue DESC
            LIMIT 10;
        """
    },
    "demographics": {
        "title": "Demographic Analysis",
        "description": "Breaks down transaction count, buyers, revenue, and average order value (AOV) by age group and gender.",
        "sql": """
            WITH customer_demographics AS (
                SELECT 
                    c.customer_id,
                    c.gender,
                    CASE 
                        WHEN c.age < 25 THEN '18-24'
                        WHEN c.age BETWEEN 25 AND 34 THEN '25-34'
                        WHEN c.age BETWEEN 35 AND 44 THEN '35-44'
                        WHEN c.age BETWEEN 45 AND 54 THEN '45-54'
                        ELSE '55+'
                    END AS age_group
                FROM customers c
            )
            SELECT 
                cd.age_group,
                cd.gender,
                COUNT(DISTINCT t.customer_id) AS unique_buyers,
                COUNT(t.transaction_id) AS total_orders,
                ROUND(SUM(t.total_amount), 2) AS total_revenue,
                ROUND(AVG(t.total_amount), 2) AS average_order_value
            FROM transactions t
            JOIN customer_demographics cd ON t.customer_id = cd.customer_id
            WHERE t.order_status = 'Completed'
            GROUP BY cd.age_group, cd.gender
            ORDER BY cd.age_group ASC, total_revenue DESC;
        """
    },
    "geography": {
        "title": "Geographic Sales Distribution",
        "description": "Analyzes the total active customer count, order volume, revenue, and Average Order Value (AOV) by state.",
        "sql": """
            SELECT 
                c.location AS state,
                COUNT(DISTINCT c.customer_id) AS active_customers,
                COUNT(t.transaction_id) AS total_orders,
                ROUND(SUM(t.total_amount), 2) AS total_revenue,
                ROUND(SUM(t.total_amount) / COUNT(t.transaction_id), 2) AS avg_order_value
            FROM transactions t
            JOIN customers c ON t.customer_id = c.customer_id
            WHERE t.order_status = 'Completed'
            GROUP BY c.location
            ORDER BY total_revenue DESC;
        """
    },
    "clv": {
        "title": "Top Customers (Lifetime Value)",
        "description": "Identifies the highest-spending customers, their order frequencies, and average purchase amounts.",
        "sql": """
            SELECT 
                c.customer_id,
                c.customer_name,
                c.email,
                c.location,
                COUNT(t.transaction_id) AS purchase_count,
                ROUND(SUM(t.total_amount), 2) AS lifetime_spend,
                ROUND(AVG(t.total_amount), 2) AS avg_purchase_amount
            FROM transactions t
            JOIN customers c ON t.customer_id = c.customer_id
            WHERE t.order_status = 'Completed'
            GROUP BY c.customer_id, c.customer_name, c.email, c.location
            ORDER BY lifetime_spend DESC
            LIMIT 10;
        """
    },
    "repeat_rate": {
        "title": "Customer Repeat Purchase Rate",
        "description": "Calculates customer loyalty metrics: total customers, count of repeat buyers, and repeat purchase rate %.",
        "sql": """
            WITH purchase_counts AS (
                SELECT 
                    customer_id,
                    COUNT(transaction_id) AS total_orders
                FROM transactions
                WHERE order_status = 'Completed'
                GROUP BY customer_id
            )
            SELECT 
                COUNT(customer_id) AS total_customers,
                SUM(CASE WHEN total_orders > 1 THEN 1 ELSE 0 END) AS repeat_customers,
                ROUND((CAST(SUM(CASE WHEN total_orders > 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(customer_id)) * 100, 2) AS repeat_purchase_rate_pct
            FROM purchase_counts;
        """
    },
    "payments": {
        "title": "Payment Method Preferences",
        "description": "Evaluates sales volume and average transaction sizes across check-out payment methods.",
        "sql": """
            SELECT 
                payment_method,
                COUNT(transaction_id) AS transaction_count,
                ROUND(SUM(total_amount), 2) AS total_revenue,
                ROUND(AVG(total_amount), 2) AS avg_transaction_amount
            FROM transactions
            WHERE order_status = 'Completed'
            GROUP BY payment_method
            ORDER BY transaction_count DESC;
        """
    },
    "discounts": {
        "title": "Discount Impact Analysis",
        "description": "Correlates discount tiers with order counts, quantity sold, total revenue, profit, and margins.",
        "sql": """
            SELECT 
                CASE 
                    WHEN discount = 0 THEN 'No Discount (0%)'
                    WHEN discount > 0 AND discount <= 0.1 THEN 'Low Discount (1-10%)'
                    WHEN discount > 0.1 AND discount <= 0.2 THEN 'Medium Discount (11-20%)'
                    ELSE 'High Discount (21%+)'
                END AS discount_range,
                COUNT(t.transaction_id) AS order_count,
                SUM(t.quantity) AS units_sold,
                ROUND(SUM(t.total_amount), 2) AS total_revenue,
                ROUND(SUM(t.total_amount - (t.quantity * p.cost)), 2) AS total_profit,
                ROUND((SUM(t.total_amount - (t.quantity * p.cost)) / SUM(t.total_amount)) * 100, 2) AS profit_margin_pct
            FROM transactions t
            JOIN products p ON t.product_id = p.product_id
            WHERE t.order_status = 'Completed'
            GROUP BY discount_range
            ORDER BY units_sold DESC;
        """
    },
    "hourly_velocity": {
        "title": "Hourly Sales Velocity",
        "description": "Maps transaction volumes and revenues by hour of the day to identify peak operational times.",
        "sql": """
            SELECT 
                strftime('%H', t.transaction_date) AS hour_of_day,
                COUNT(t.transaction_id) AS total_orders,
                ROUND(SUM(t.total_amount), 2) AS hourly_revenue,
                SUM(t.quantity) AS items_sold
            FROM transactions t
            WHERE t.order_status = 'Completed'
            GROUP BY hour_of_day
            ORDER BY hour_of_day ASC;
        """
    },
    "sub_categories": {
        "title": "High Margin Sub-categories",
        "description": "Drills down to product sub-categories, sorted by net profit contribution and profit margins.",
        "sql": """
            SELECT 
                p.category,
                p.sub_category,
                SUM(t.quantity) AS units_sold,
                ROUND(SUM(t.total_amount), 2) AS total_revenue,
                ROUND(SUM(t.total_amount - (t.quantity * p.cost)), 2) AS net_profit,
                ROUND((SUM(t.total_amount - (t.quantity * p.cost)) / SUM(t.total_amount)) * 100, 2) AS net_margin_pct
            FROM transactions t
            JOIN products p ON t.product_id = p.product_id
            WHERE t.order_status = 'Completed'
            GROUP BY p.category, p.sub_category
            ORDER BY net_profit DESC;
        """
    },
    "restock": {
        "title": "Low Stock & High Demand Restock Alerts",
        "description": "Flags items whose stock levels are lower than their 30-day sales volume. Categorizes urgency status.",
        "sql": """
            WITH recent_sales AS (
                SELECT 
                    product_id,
                    SUM(quantity) AS quantity_sold_30_days
                FROM transactions
                WHERE transaction_date >= datetime('now', '-30 days')
                  AND order_status = 'Completed'
                GROUP BY product_id
            )
            SELECT 
                p.product_id,
                p.product_name,
                p.category,
                p.stock_quantity AS current_stock,
                COALESCE(r.quantity_sold_30_days, 0) AS units_sold_last_30_days,
                CASE 
                    WHEN p.stock_quantity = 0 THEN 'OUT OF STOCK'
                    WHEN p.stock_quantity <= COALESCE(r.quantity_sold_30_days, 0) / 2 THEN 'CRITICAL REORDER'
                    ELSE 'LOW STOCK'
                END AS stock_status
            FROM products p
            LEFT JOIN recent_sales r ON p.product_id = r.product_id
            WHERE p.stock_quantity <= COALESCE(r.quantity_sold_30_days, 0)
            ORDER BY units_sold_last_30_days DESC;
        """
    },
    "returns": {
        "title": "Return Rates by Product Category",
        "description": "Calculates returned orders vs total order count, expressing return rate percentage by category.",
        "sql": """
            SELECT 
                p.category,
                COUNT(t.transaction_id) AS total_orders,
                SUM(CASE WHEN t.order_status = 'Returned' THEN 1 ELSE 0 END) AS returned_orders,
                ROUND((CAST(SUM(CASE WHEN t.order_status = 'Returned' THEN 1 ELSE 0 END) AS REAL) / COUNT(t.transaction_id)) * 100, 2) AS return_rate_pct
            FROM transactions t
            JOIN products p ON t.product_id = p.product_id
            GROUP BY p.category
            ORDER BY return_rate_pct DESC;
        """
    },
    "mom_growth": {
        "title": "Month-over-Month Revenue Growth",
        "description": "Uses LAG window function to compare current monthly sales with the prior month and calculate % variance.",
        "sql": """
            WITH monthly_revenue AS (
                SELECT 
                    strftime('%Y-%m', transaction_date) AS month,
                    ROUND(SUM(total_amount), 2) AS current_month_revenue
                FROM transactions
                WHERE order_status = 'Completed'
                GROUP BY month
            )
            SELECT 
                month,
                current_month_revenue,
                LAG(current_month_revenue, 1) OVER (ORDER BY month) AS previous_month_revenue,
                ROUND(
                    ((current_month_revenue - LAG(current_month_revenue, 1) OVER (ORDER BY month)) / 
                    LAG(current_month_revenue, 1) OVER (ORDER BY month)) * 100, 
                2) AS mom_growth_rate_pct
            FROM monthly_revenue;
        """
    },
    "top_products_category": {
        "title": "Top 3 Products Per Category",
        "description": "Uses DENSE_RANK partition to extract the top 3 best-selling products within each product category.",
        "sql": """
            WITH product_rankings AS (
                SELECT 
                    p.category,
                    p.product_name,
                    SUM(t.quantity) AS total_sold,
                    DENSE_RANK() OVER (PARTITION BY p.category ORDER BY SUM(t.quantity) DESC) AS sales_rank
                FROM transactions t
                JOIN products p ON t.product_id = p.product_id
                WHERE t.order_status = 'Completed'
                GROUP BY p.category, p.product_name
            )
            SELECT 
                category,
                product_name,
                total_sold,
                sales_rank
            FROM product_rankings
            WHERE sales_rank <= 3;
        """
    },
    "rfm": {
        "title": "RFM Customer Segmentation",
        "description": "Calculates Recency, Frequency, and Monetary values to rank customers in behavior groups (VIP, At Risk, Loyal, etc.).",
        "sql": """
            WITH rfm_raw AS (
                SELECT 
                    customer_id,
                    MIN(julianday('2026-01-01') - julianday(transaction_date)) AS recency_days,
                    COUNT(transaction_id) AS frequency,
                    SUM(total_amount) AS monetary
                FROM transactions
                WHERE order_status = 'Completed'
                GROUP BY customer_id
            ),
            rfm_scores AS (
                SELECT 
                    customer_id,
                    recency_days,
                    frequency,
                    monetary,
                    NTILE(5) OVER (ORDER BY recency_days DESC) AS r_score,
                    NTILE(5) OVER (ORDER BY frequency ASC) AS f_score,
                    NTILE(5) OVER (ORDER BY monetary ASC) AS m_score
                FROM rfm_raw
            )
            SELECT 
                rs.customer_id,
                c.customer_name,
                rs.recency_days,
                rs.frequency,
                ROUND(rs.monetary, 2) AS total_spend,
                (rs.r_score || '-' || rs.f_score || '-' || rs.m_score) AS rfm_combined_score,
                CASE 
                    WHEN rs.r_score >= 4 AND rs.f_score >= 4 AND rs.m_score >= 4 THEN 'VIP/Champions'
                    WHEN rs.r_score >= 3 AND rs.f_score >= 3 THEN 'Loyal Customers'
                    WHEN rs.r_score >= 4 AND rs.f_score = 1 THEN 'New Customers'
                    WHEN rs.r_score <= 2 AND rs.f_score >= 3 THEN 'At Risk / Need Attention'
                    WHEN rs.r_score <= 1 AND rs.f_score <= 2 THEN 'Lost Customers'
                    ELSE 'General/Active'
                END AS customer_segment
            FROM rfm_scores rs
            JOIN customers c ON rs.customer_id = c.customer_id
            ORDER BY total_spend DESC
            LIMIT 15;
        """
    }
}

class DashboardHTTPRequestHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Allow cross-origin requests for API calls, if served separately
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # API Handlers
        if path == "/api/queries-list":
            self.send_json_response(200, {
                key: {"title": val["title"], "description": val["description"], "sql": val["sql"]} 
                for key, val in QUERIES.items()
            })
            return

        elif path.startswith("/api/query/"):
            query_key = path.replace("/api/query/", "")
            if query_key in QUERIES:
                self.run_predefined_query(QUERIES[query_key]["sql"])
            else:
                self.send_json_response(404, {"error": f"Query key '{query_key}' not found."})
            return
            
        elif path == "/api/database-summary":
            self.get_db_summary()
            return

        # Static Files Handlers
        else:
            # Normalize path
            if path == "/":
                path = "/index.html"
            
            # File system path
            filepath = os.path.join(os.getcwd(), "public", path.lstrip("/"))
            
            # Prevent directory traversal attacks
            public_dir = os.path.join(os.getcwd(), "public")
            if not os.path.abspath(filepath).startswith(os.path.abspath(public_dir)):
                self.send_error_response(403, "Access Forbidden")
                return

            if os.path.exists(filepath) and os.path.isfile(filepath):
                # Set mime types
                mime_type = "text/html"
                if filepath.endswith(".css"):
                    mime_type = "text/css"
                elif filepath.endswith(".js"):
                    mime_type = "application/javascript"
                elif filepath.endswith(".json"):
                    mime_type = "application/json"
                elif filepath.endswith(".png"):
                    mime_type = "image/png"
                elif filepath.endswith(".jpg") or filepath.endswith(".jpeg"):
                    mime_type = "image/jpeg"
                elif filepath.endswith(".ico"):
                    mime_type = "image/x-icon"
                
                try:
                    with open(filepath, 'rb') as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header("Content-Type", mime_type)
                    self.send_header("Content-Length", str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                except Exception as e:
                    self.send_error_response(500, f"Internal Server Error: {str(e)}")
            else:
                self.send_error_response(404, "File Not Found")

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        if path == "/api/run-custom-query":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                data = json.loads(post_data.decode('utf-8'))
                custom_sql = data.get("sql", "")
                
                # Check for SELECT statement (Security check)
                cleaned_sql = custom_sql.strip().lower()
                if not cleaned_sql.startswith("select") and not cleaned_sql.startswith("with"):
                    self.send_json_response(400, {
                        "error": "Security Restriction: Only read-only SELECT and WITH statements are allowed."
                    })
                    return
                
                # Exclude queries containing modifying keywords
                forbidden = ["insert ", "update ", "delete ", "drop ", "alter ", "create ", "replace ", "truncate ", "vacuum "]
                if any(word in cleaned_sql for word in forbidden):
                    self.send_json_response(400, {
                        "error": "Security Restriction: Write operations are forbidden."
                    })
                    return

                self.run_custom_query(custom_sql)
            except json.JSONDecodeError:
                self.send_json_response(400, {"error": "Invalid JSON format."})
            except Exception as e:
                self.send_json_response(500, {"error": f"Failed to execute: {str(e)}"})
        else:
            self.send_error_response(404, "Endpoint Not Found")

    def send_json_response(self, status, payload):
        response_bytes = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.end_headers()
        self.wfile.write(response_bytes)

    def send_error_response(self, status, message):
        self.send_json_response(status, {"error": message})

    def get_db_summary(self):
        if not os.path.exists(DB_FILE):
            self.send_json_response(503, {"error": f"Database file '{DB_FILE}' not found. Please run data_generator.py first."})
            return

        try:
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            
            # Count records
            cursor.execute("SELECT COUNT(*) FROM customers;")
            cust_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM products;")
            prod_count = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM transactions;")
            tx_count = cursor.fetchone()[0]
            
            # Schema information
            schema = {}
            for table in ["customers", "products", "transactions"]:
                cursor.execute(f"PRAGMA table_info({table});")
                columns = cursor.fetchall()
                schema[table] = [
                    {"name": col[1], "type": col[2], "notnull": bool(col[3]), "pk": bool(col[5])}
                    for col in columns
                ]

            self.send_json_response(200, {
                "counts": {
                    "customers": cust_count,
                    "products": prod_count,
                    "transactions": tx_count
                },
                "schema": schema,
                "db_type": "SQLite"
            })
            conn.close()
        except Exception as e:
            self.send_json_response(500, {"error": f"Database summary query failed: {str(e)}"})

    def run_predefined_query(self, sql):
        self.execute_sql(sql)

    def run_custom_query(self, sql):
        self.execute_sql(sql, include_explain=True)

    def execute_sql(self, sql, include_explain=False):
        if not os.path.exists(DB_FILE):
            self.send_json_response(503, {"error": f"Database file '{DB_FILE}' not found. Please run data_generator.py."})
            return

        conn = None
        try:
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Measure performance
            start_time = time.perf_counter()
            cursor.execute(sql)
            rows = cursor.fetchall()
            end_time = time.perf_counter()
            execution_time_ms = round((end_time - start_time) * 1000, 3)

            # Extract columns
            columns = [description[0] for description in cursor.description] if cursor.description else []
            
            # Convert results to standard lists/dicts
            results = []
            for row in rows:
                results.append(dict(row))

            explain_plan = []
            if include_explain:
                try:
                    cursor.execute(f"EXPLAIN QUERY PLAN {sql}")
                    explain_rows = cursor.fetchall()
                    for exp in explain_rows:
                        explain_plan.append(f"Detail: {exp['detail']}")
                except Exception:
                    explain_plan = ["Explain query plan not supported for this query structure."]

            self.send_json_response(200, {
                "columns": columns,
                "data": results,
                "rowCount": len(results),
                "executionTimeMs": execution_time_ms,
                "explainPlan": explain_plan
            })

        except sqlite3.Error as e:
            self.send_json_response(400, {
                "error": f"SQL syntax or execution error: {str(e)}"
            })
        except Exception as e:
            self.send_json_response(500, {
                "error": f"Internal query execution error: {str(e)}"
            })
        finally:
            if conn:
                conn.close()

def run_server():
    if not os.path.exists(DB_FILE):
        print(f"Warning: Database '{DB_FILE}' not found. Please generate it using 'python data_generator.py'")
        
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, DashboardHTTPRequestHandler)
    print(f"============================================================")
    print(f"Online Shopping Sales Analytics Server Running Successfully!")
    print(f"Dashboard: http://localhost:{PORT}")
    print(f"Press Ctrl+C to stop the server.")
    print(f"============================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        sys.exit(0)

if __name__ == "__main__":
    run_server()
