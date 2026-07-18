-- ====================================================================
-- ONLINE SHOPPING SALES ANALYTICS - 17 ADVANCED SQL QUERIES
-- Optimized for SQLite & MySQL databases
-- ====================================================================

-- 1. OVERALL BUSINESS KEY PERFORMANCE INDICATORS (KPIs)
-- Calculates total revenue, total cost, total profit, total quantity sold, and average profit margin.
-- Target Table: transactions JOIN products
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


-- 2. MONTHLY REVENUE & PROFIT TRENDS
-- Breaks down revenue, profit, and order volume month-by-month to evaluate seasonality.
-- Target Table: transactions JOIN products
SELECT 
    strftime('%Y-%m', t.transaction_date) AS month, -- For SQLite (use DATE_FORMAT(t.transaction_date, '%Y-%m') in MySQL)
    COUNT(t.transaction_id) AS order_count,
    ROUND(SUM(t.total_amount), 2) AS monthly_revenue,
    ROUND(SUM(t.total_amount - (t.quantity * p.cost)), 2) AS monthly_profit
FROM transactions t
JOIN products p ON t.product_id = p.product_id
WHERE t.order_status = 'Completed'
GROUP BY month
ORDER BY month ASC;


-- 3. CATEGORY PERFORMANCE METRICS
-- Ranks categories by revenue, items sold, and profitability.
-- Target Table: transactions JOIN products
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


-- 4. TOP 10 BEST-SELLING PRODUCTS BY REVENUE
-- Identifies the high-value product drivers in the catalog.
-- Target Table: transactions JOIN products
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


-- 5. CUSTOMER DEMOGRAPHICS ANALYSIS (AGE GROUPS & GENDER)
-- Analyzes spending behaviors across different demographic brackets.
-- Target Table: transactions JOIN customers
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


-- 6. GEOGRAPHIC SALES DISTRIBUTION
-- Aggregates sales volume, total revenue, and unique customer counts by state/location.
-- Target Table: transactions JOIN customers
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


-- 7. TOP 10 CUSTOMERS BY LIFETIME VALUE (CLV)
-- Ranks high-value customers based on lifetime spend, average order value, and purchase frequency.
-- Target Table: transactions JOIN customers
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


-- 8. REPEAT PURCHASE RATE (CUSTOMER RETENTION)
-- Calculates the proportion of customers who have ordered more than once.
-- Target Table: transactions
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


-- 9. PAYMENT METHOD PREFERENCE AND EFFICIENCY
-- Measures popular check-out methods and average transaction size per payment type.
-- Target Table: transactions
SELECT 
    payment_method,
    COUNT(transaction_id) AS transaction_count,
    ROUND(SUM(total_amount), 2) AS total_revenue,
    ROUND(AVG(total_amount), 2) AS avg_transaction_amount
FROM transactions
WHERE order_status = 'Completed'
GROUP BY payment_method
ORDER BY transaction_count DESC;


-- 10. IMPACT OF DISCOUNTS ON QUANTITY SOLD AND PROFITABILITY
-- Analyzes how offering discounts correlates with volume and profit margins.
-- Target Table: transactions JOIN products
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


-- 11. HOUR-OF-DAY SALES VELOCITY (PEAK SHOPPING HOURS)
-- Identifies peak purchase hours to inform marketing and server capacity planning.
-- Target Table: transactions
SELECT 
    -- For SQLite (extract hour)
    strftime('%H', t.transaction_date) AS hour_of_day, -- (use HOUR(t.transaction_date) in MySQL)
    COUNT(t.transaction_id) AS total_orders,
    ROUND(SUM(t.total_amount), 2) AS hourly_revenue,
    SUM(t.quantity) AS items_sold
FROM transactions t
WHERE t.order_status = 'Completed'
GROUP BY hour_of_day
ORDER BY hour_of_day ASC;


-- 12. HIGH-PERFORMING SUB-CATEGORIES BY PROFIT MARGIN
-- Finds sub-categories that provide the best returns for inventory investment.
-- Target Table: products JOIN transactions
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


-- 13. RESTOCK ALERT: HIGH SALES VELOCITY WITH LOW INVENTORY
-- Identifies top products that are selling fast but have low stock.
-- Target Table: products JOIN transactions (analyzing last 30 days of sales vs. current stock)
WITH recent_sales AS (
    SELECT 
        product_id,
        SUM(quantity) AS quantity_sold_30_days
    FROM transactions
    WHERE transaction_date >= datetime('now', '-30 days') -- For SQLite (use NOW() - INTERVAL 30 DAY in MySQL)
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


-- 14. RETURN RATE BY PRODUCT CATEGORY
-- Pinpoints categories with high return rates to investigate product quality or description issues.
-- Target Table: transactions JOIN products
SELECT 
    p.category,
    COUNT(t.transaction_id) AS total_orders,
    SUM(CASE WHEN t.order_status = 'Returned' THEN 1 ELSE 0 END) AS returned_orders,
    ROUND((CAST(SUM(CASE WHEN t.order_status = 'Returned' THEN 1 ELSE 0 END) AS REAL) / COUNT(t.transaction_id)) * 100, 2) AS return_rate_pct
FROM transactions t
JOIN products p ON t.product_id = p.product_id
GROUP BY p.category
ORDER BY return_rate_pct DESC;


-- 15. MONTH-OVER-MONTH (MoM) REVENUE GROWTH RATE (Window Function: LAG)
-- Tracks the growth momentum of the platform month-over-month.
-- Target Table: transactions
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


-- 16. TOP 3 BEST SELLING PRODUCTS PER CATEGORY (Window Function: DENSE_RANK)
-- Ranks items within their categories to show best sellers.
-- Target Table: transactions JOIN products
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


-- 17. RFM CUSTOMER SEGMENTATION (Recency, Frequency, Monetary)
-- Segments customers based on how recently they bought, how often they buy, and how much they spend.
-- Target Table: transactions JOIN customers
WITH rfm_raw AS (
    SELECT 
        customer_id,
        -- Recency: Days since last completed purchase (assume current analysis date is end of 2025)
        MIN(julianday('2026-01-01') - julianday(transaction_date)) AS recency_days,
        -- Frequency: Number of completed transactions
        COUNT(transaction_id) AS frequency,
        -- Monetary: Total spend
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
        -- Assign scores from 1 (worst) to 5 (best) using NTILE
        NTILE(5) OVER (ORDER BY recency_days DESC) AS r_score, -- Less days = higher score
        NTILE(5) OVER (ORDER BY frequency ASC) AS f_score,     -- More frequency = higher score
        NTILE(5) OVER (ORDER BY monetary ASC) AS m_score       -- More spend = higher score
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
