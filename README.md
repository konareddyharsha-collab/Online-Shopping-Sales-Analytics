# NexCart: Online Shopping Sales Analytics System

An enterprise-grade, self-contained Sales Analytics platform that models a relational database with **22,500 realistic shopping transactions**, executes **17 advanced SQL queries**, and renders them in a stunning, **glassmorphic interactive web dashboard**.

---

## 🌟 Key Features

- **Relational Schema Design**: Includes three primary tables: `customers`, `products`, and `transactions` modeling standard e-commerce setups.
- **Robust Synthetic Data Generator**: Creates 1,200 unique customers, a structured product catalog, and 22,500 sales transactions distributed across 2 years (2024–2025) with realistic seasonal, weekly, hourly, and demographic patterns.
- **17 Advanced Analytical SQL Queries**: Includes multi-stage CTEs, Window Functions (`LAG`, `DENSE_RANK`, `NTILE`), conditional aggregations, cohorts, and metrics like CLV, RFM segmentation, and MoM growth.
- **Predefined REST API Server**: A lightweight, dependency-free Python backend served on port 8000 using standard libraries (`http.server`, `sqlite3`, `json`).
- **Interactive SQL Console**: Write custom queries against the 20,000+ record indexes directly in the browser. Features execution safety checks, performance timers, syntax diagnostic output, `EXPLAIN QUERY PLAN` optimization trees, and CSV downloads.
- **Premium Glassmorphic UI**: Beautiful dark-mode dashboard styled with CSS Grid/Flexbox, custom typography, hover transitions, and dynamic Chart.js visualizations.

---

## 📁 Project Directory Structure

```
Online Shopping Sales Analytics/
├── public/
│   ├── index.html         # Dashboard HTML structure
│   ├── style.css          # Glassmorphic dark-mode CSS styles
│   └── app.js             # Client-side API fetch & Chart.js renderer
├── data_generator.py      # Generates sales.db (SQLite) & online_shopping_sales.sql (MySQL)
├── server.py              # Custom Python HTTP Server & SQL execution API
├── queries.sql            # Master file with 17 commented advanced queries
└── README.md              # Project documentation
```

---

## 💾 Database Schema

The system supports both **SQLite** (local runtime database) and **MySQL** (using the auto-generated `online_shopping_sales.sql` script).

### Schema Diagram (Entity Relationships)
```
  [customers]                  [products]
  - customer_id (PK, Int)      - product_id (PK, Int)
  - customer_name (Varchar)    - product_name (Varchar)
  - email (Unique, Varchar)    - category (Varchar)
  - gender (Varchar)           - sub_category (Varchar)
  - age (Int)                  - price (Decimal)
  - location (Varchar)         - cost (Decimal)
  - signup_date (Date)         - stock_quantity (Int)
        │                            │
        └──────────────┬─────────────┘
                       ▼
                 [transactions]
                 - transaction_id (PK, Int)
                 - customer_id (FK, Int)
                 - product_id (FK, Int)
                 - transaction_date (Datetime)
                 - quantity (Int)
                 - unit_price (Decimal)
                 - discount (Decimal)
                 - total_amount (Decimal)
                 - payment_method (Varchar)
                 - shipping_method (Varchar)
                 - order_status (Varchar)
```

---

## 📊 The 17 SQL Queries Included

All queries are fully documented and structured in `queries.sql`:
1. **Core Business KPIs**: Total orders, items sold, revenue, COGS, net profit, and net margin %.
2. **Monthly Trends**: Seasonality and revenue/profit metrics over 24 months.
3. **Category Rankings**: Revenue, profit contribution, and margin per product category.
4. **Top 10 Selling Products**: Top items driving top-line revenue.
5. **Customer Demographics**: Spending power grouped by gender and age brackets (18-24, 25-34, etc.).
6. **Geographic Distribution**: Heatmap-compatible rankings of customer state locations.
7. **Customer Lifetime Value (CLV)**: Ranks customers by cumulative transactional spend.
8. **Repeat Purchase Rate**: Percentage of customers completing more than one transaction.
9. **Payment Method Efficiency**: Popularity and average order size by checkout gateway.
10. **Discount Strategy Impact**: Analyzes whether discount ranges correlate with net margins.
11. **Hourly Sales Velocity**: Hour-by-hour transaction frequencies (peak shopping hours).
12. **High-Margin Sub-categories**: Discovers profitable subcategories.
13. **Restock Inventory Alerts**: Flags fast-selling products whose 30-day velocity exceeds current stock.
14. **Return Rates by Category**: Audits product quality issues by examining returned orders.
15. **Month-over-Month Revenue Growth**: Evaluates sales momentum using the `LAG` window function.
16. **Top 3 Products Per Category**: Ranks items locally in categories using the `DENSE_RANK` window partition.
17. **RFM Segmentation (Recency, Frequency, Monetary)**: Assigns customer segments (VIP, Loyal, At Risk, Lost) using `NTILE(5)` scores.

---

## 🚀 Setup & Launch Instructions

### Prerequisites
- **Python 3.x** must be installed on your local machine.
- No external packages (like Flask, Django, or SQLAlchemy) are required. The project runs on standard libraries!

### Step 1: Generate Database & Data Dump
Generate the SQLite database (`sales.db`) and the MySQL-compatible schema dump (`online_shopping_sales.sql`):
```bash
python data_generator.py
```
*Execution creates a 5MB+ SQLite database populated with 22,500 realistic records and prints summary tallies.*

### Step 2: Start Python Web & API Server
Run the backend server locally:
```bash
python server.py
```
*This binds to port 8000 and connects to `sales.db`. Keep this window open.*

### Step 3: Open Dashboard
Open your web browser and navigate to:
```
http://localhost:8000
```
Explore the dashboard metrics, toggle navigation panels, and execute queries dynamically using the console!

---

## 🏛️ MySQL Database Integration

To run this dataset on a production MySQL database:
1. Copy the auto-generated [online_shopping_sales.sql](file:///c:/Users/konar/OneDrive/Desktop/Online%20Shopping%20Sales%20Analytics/online_shopping_sales.sql) script.
2. Run it inside your MySQL shell or client (like phpMyAdmin, DBeaver, or Workbench):
   ```sql
   SOURCE online_shopping_sales.sql;
   ```
3. Copy the MySQL-adapted version of the queries from [queries.sql](file:///c:/Users/konar/OneDrive/Desktop/Online%20Shopping%20Sales%20Analytics/queries.sql) (adapted notes are provided in query comments where date formats differ, e.g., `DATE_FORMAT` instead of `strftime`, `NOW() - INTERVAL 30 DAY` instead of `datetime('now', '-30 days')`).
