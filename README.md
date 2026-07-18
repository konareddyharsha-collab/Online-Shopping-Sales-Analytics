# NexCart: Online Shopping Sales Analytics System

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Database: SQLite WASM](https://img.shields.io/badge/Database-SQLite%20WASM-003B57.svg?logo=sqlite)](https://sqlite.org/)
[![UI: Vanilla JS & CSS](https://img.shields.io/badge/UI-Vanilla%20JS%20%26%20CSS-F7DF1E.svg?logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Charts: Chart.js](https://img.shields.io/badge/Charts-Chart.js-FF6384.svg?logo=chartdotjs)](https://www.chartjs.org/)

NexCart is an enterprise-grade, serverless Sales Analytics Platform. It features a relational schema containing **22,500 realistic transaction records** and an interactive, glassmorphic executive dashboard that executes **17 advanced analytical queries** directly in the browser via SQLite WebAssembly (WASM).

---

## 🎯 Project Overview & Objective

The primary objective of this project is to simulate, query, and visualize key sales performance metrics for an online retail platform. By leveraging advanced SQL capabilities, the platform extracts business intelligence to solve three critical retail challenges:
1. **Revenue Leakage**: Identifying product return rates and high discount erosion margins.
2. **Customer Retention**: Segmenting customers using RFM analysis to identify VIP cohorts and at-risk churn groups.
3. **Inventory Management**: Automatically flagging low-stock items with high sales velocity (30-day run rate).

---

## 📁 Repository Structure

```
Online-Shopping-Sales-Analytics/
├── public/
│   ├── index.html          # Glassmorphic Executive Dashboard
│   ├── style.css           # Vanilla CSS Styling & Visual Tokens
│   ├── app.js              # Client-Side WASM SQL Execution & Chart.js Config
│   └── sales.db            # SQLite Database File containing 22,500 records
├── data_generator.py       # Python script generating database & SQL export
├── online_shopping_sales.sql# MySQL Database schema & data population dump
├── queries.sql             # SQL Script containing the 17 commented advanced queries
├── server.py               # Optional Python local REST API server fallback
└── README.md               # Production documentation
```

---

## 💾 Relational Database Schema

The database design contains 3 normalized tables:

```
  ┌────────────────────────┐         ┌────────────────────────┐
  │       customers        │         │        products        │
  ├────────────────────────┤         ├────────────────────────┤
  │ customer_id (PK, Int)  │         │ product_id (PK, Int)   │
  │ customer_name (Varchar)│         │ product_name (Varchar) │
  │ email (Unique, Varchar)│         │ category (Varchar)     │
  │ gender (Varchar)       │         │ sub_category (Varchar) │
  │ age (Int)              │         │ price (Decimal)        │
  │ location (Varchar)     │         │ cost (Decimal)         │
  │ signup_date (Date)     │         │ stock_quantity (Int)   │
  └───────────┬────────────┘         └───────────┬────────────┘
              │                                  │
              └────────────────┬─────────────────┘
                               ▼
                ┌────────────────────────┐
                │      transactions      │
                ├────────────────────────┤
                │ transaction_id (PK)    │
                │ customer_id (FK)       │
                │ product_id (FK)        │
                │ transaction_date (DT)  │
                │ quantity (Int)         │
                │ unit_price (Decimal)   │
                │ discount (Decimal)     │
                │ total_amount (Decimal) │
                │ payment_method (Varchar)
                │ shipping_method (Varchar)
                │ order_status (Varchar) │
                └────────────────────────┘
```

---

## 📊 Analytical SQL Queries Directory

All 17 queries are preloaded in [queries.sql](queries.sql) and the SQL Console.

| ID | Name | Core SQL Mechanics | Business Insight |
|:---|:---|:---|:---|
| **1** | Core Business KPIs | Basic Aggregations (`SUM`, `ROUND`) | Total Revenue, Profit, and Net Profit Margins. |
| **2** | Monthly Trends | Date Formats, Grouping | Year-over-Year run-rates & holiday spikes. |
| **3** | Category Share | Joining, Aggregations | Revenue contributions by major product lines. |
| **4** | Top 10 Best Sellers | `LIMIT`, Sorting | High-value items generating top-line sales. |
| **5** | Customer Demographics | `WITH` CTE, `CASE WHEN` brackets | Value distribution by gender and age segments. |
| **6** | Geographic Growth | Grouping by State | Geographic hubs driving high Average Order Value (AOV). |
| **7** | Lifetime Value (CLV) | Customer joins, grouping | Ranks top 10 customers by cumulative net spend. |
| **8** | Retention Rate | Subquery, Condition check | Ratio of repeat shoppers to one-time buyers. |
| **9** | Gateway Share | Grouping by payment type | Customer preferences and checkout frequencies. |
| **10** | Discount Impact | Bracket categorization | Analyzes if discounts erode profit margins. |
| **11** | Hourly Velocity | Date hour extractions | Identifies peak shopping times for load management. |
| **12** | Sub-Category Profit | Grouping, Margins | Identifies high-margin niches for inventory expansion. |
| **13** | Inventory Reorder | Common Table Expressions (CTE) | Flags fast-selling items with critical stock levels. |
| **14** | Category Return Rates | Conditional grouping | Flags product lines with high returns for auditing. |
| **15** | Month-over-Month Growth| Window Function (`LAG`) | Tracks sales momentum variances month-to-month. |
| **16** | Local Sales Ranking | Window Function (`DENSE_RANK`) | Extracts top 3 products in each category. |
| **17** | RFM Segmentation | Window Function (`NTILE`), String concat | Classifies users (VIP, Loyal, Churn Risk, Lost). |

---

## 🚀 Getting Started

### Method A: Zero Setup (Client-Side WASM Website)
You do not need to install Python libraries or database servers to load this project! 
1. Run a simple local file server in the `public` directory:
   ```bash
   cd public
   python -m http.server 8000
   ```
2. Open your browser and navigate to: **[http://localhost:8000](http://localhost:8000)**
*The browser loads SQLite directly in WebAssembly, downloading the `sales.db` file and running queries client-side.*

### Method B: Optional Python REST API Server Fallback
If you wish to run a dedicated backend server instead of loading the database in the browser:
1. Run `python server.py` in the root folder.
2. The server connects locally to `sales.db` and opens an API port. Navigate to **[http://localhost:8000](http://localhost:8000)**.

---

## ☁️ Production Deployment

### 1-Click Deployment (GitHub Pages)
Since this dashboard runs entirely client-side via SQLite WebAssembly, you can deploy it as a static page:
1. Push this folder to a GitHub Repository.
2. Go to **Settings** > **Pages** in your repository.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose the `main` branch and select the `/public` folder, then click **Save**.
5. Once built, access the live link directly!
