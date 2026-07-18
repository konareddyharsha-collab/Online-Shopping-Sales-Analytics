/**
 * NexCart Sales Analytics Dashboard Application Logic
 * Client-Side WebAssembly SQLite Architecture
 * Communicates directly with sales.db in the browser using SQL.js WASM
 */

// Predefined queries matching queries.sql
const QUERIES = {
    kpis: {
        title: "Core KPI Summary",
        description: "Calculates total orders, total items sold, total revenue, total cost, net profit, and average profit margin for completed orders.",
        sql: `
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
        `
    },
    trends: {
        title: "Monthly Revenue & Profit Trends",
        description: "Aggregates revenue, profit, and order count by month to track growth trends and seasonality.",
        sql: `
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
        `
    },
    categories: {
        title: "Category Performance",
        description: "Ranks product categories by unit volume, revenue, profit, and profit margin.",
        sql: `
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
        `
    },
    top_products: {
        title: "Top 10 Selling Products",
        description: "Finds the top 10 products based on total sales revenue.",
        sql: `
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
        `
    },
    demographics: {
        title: "Demographic Analysis",
        description: "Breaks down transaction count, buyers, revenue, and average order value (AOV) by age group and gender.",
        sql: `
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
        `
    },
    geography: {
        title: "Geographic Sales Distribution",
        description: "Analyzes the total active customer count, order volume, revenue, and Average Order Value (AOV) by state.",
        sql: `
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
        `
    },
    clv: {
        title: "Top Customers (Lifetime Value)",
        description: "Identifies the highest-spending customers, their order frequencies, and average purchase amounts.",
        sql: `
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
        `
    },
    repeat_rate: {
        title: "Customer Repeat Purchase Rate",
        description: "Calculates customer loyalty metrics: total customers, count of repeat buyers, and repeat purchase rate %.",
        sql: `
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
        `
    },
    payments: {
        title: "Payment Method Preferences",
        description: "Evaluates sales volume and average transaction sizes across check-out payment methods.",
        sql: `
            SELECT 
                payment_method,
                COUNT(transaction_id) AS transaction_count,
                ROUND(SUM(total_amount), 2) AS total_revenue,
                ROUND(AVG(total_amount), 2) AS avg_transaction_amount
            FROM transactions
            WHERE order_status = 'Completed'
            GROUP BY payment_method
            ORDER BY transaction_count DESC;
        `
    },
    discounts: {
        title: "Discount Impact Analysis",
        description: "Correlates discount tiers with order counts, quantity sold, total revenue, profit, and margins.",
        sql: `
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
        `
    },
    hourly_velocity: {
        title: "Hourly Sales Velocity",
        description: "Maps transaction volumes and revenues by hour of the day to identify peak operational times.",
        sql: `
            SELECT 
                strftime('%H', t.transaction_date) AS hour_of_day,
                COUNT(t.transaction_id) AS total_orders,
                ROUND(SUM(t.total_amount), 2) AS hourly_revenue,
                SUM(t.quantity) AS items_sold
            FROM transactions t
            WHERE t.order_status = 'Completed'
            GROUP BY hour_of_day
            ORDER BY hour_of_day ASC;
        `
    },
    sub_categories: {
        title: "High Margin Sub-categories",
        description: "Drills down to product sub-categories, sorted by net profit contribution and profit margins.",
        sql: `
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
        `
    },
    restock: {
        title: "Low Stock & High Demand Restock Alerts",
        description: "Flags items whose stock levels are lower than their 30-day sales volume. Categorizes urgency status.",
        sql: `
            WITH recent_sales AS (
                SELECT 
                    product_id,
                    SUM(quantity) AS quantity_sold_30_days
                FROM transactions
                WHERE transaction_date >= datetime('2025-12-01')
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
        `
    },
    returns: {
        title: "Return Rates by Product Category",
        description: "Calculates returned orders vs total order count, expressing return rate percentage by category.",
        sql: `
            SELECT 
                p.category,
                COUNT(t.transaction_id) AS total_orders,
                SUM(CASE WHEN t.order_status = 'Returned' THEN 1 ELSE 0 END) AS returned_orders,
                ROUND((CAST(SUM(CASE WHEN t.order_status = 'Returned' THEN 1 ELSE 0 END) AS REAL) / COUNT(t.transaction_id)) * 100, 2) AS return_rate_pct
            FROM transactions t
            JOIN products p ON t.product_id = p.product_id
            GROUP BY p.category
            ORDER BY return_rate_pct DESC;
        `
    },
    mom_growth: {
        title: "Month-over-Month Revenue Growth",
        description: "Uses LAG window function to compare current monthly sales with the prior month and calculate % variance.",
        sql: `
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
        `
    },
    top_products_category: {
        title: "Top 3 Products Per Category",
        description: "Uses DENSE_RANK partition to extract the top 3 best-selling products within each product category.",
        sql: `
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
        `
    },
    rfm: {
        title: "RFM Customer Segmentation",
        description: "Calculates Recency, Frequency, and Monetary values to rank customers in behavior groups (VIP, At Risk, Loyal, etc.).",
        sql: `
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
        `
    }
};

// Application State
const state = {
    activeTab: 'overview',
    currentConsoleData: null,
    db: null,
    isDemoMode: false
};

// Global Chart Store
const charts = {
    trend: null,
    category: null,
    products: null,
    payments: null,
    demographics: null,
    discountMargin: null,
    hourly: null
};

// UI Elements
const els = {
    tabs: document.querySelectorAll('.nav-item'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    pageTitle: document.getElementById('page-title'),
    pageSubtitle: document.getElementById('page-subtitle'),
    dbRecordsCount: document.getElementById('db-records-count'),
    btnRefresh: document.getElementById('btn-refresh'),
    
    // KPIs
    kpiRevenue: document.getElementById('kpi-revenue'),
    kpiProfit: document.getElementById('kpi-profit'),
    kpiMargin: document.getElementById('kpi-margin'),
    kpiOrders: document.getElementById('kpi-orders'),
    
    // Tables
    tblSubcategories: document.querySelector('#tbl-subcategories tbody'),
    tblRestock: document.querySelector('#tbl-restock tbody'),
    tblCatTopProducts: document.querySelector('#tbl-category-top-products tbody'),
    tblRfm: document.querySelector('#tbl-rfm tbody'),
    tblGeography: document.querySelector('#tbl-geography tbody'),
    tblReturns: document.querySelector('#tbl-returns tbody'),
    
    // Customer Metrics
    retentionPct: document.getElementById('retention-pct'),
    retentionTotal: document.getElementById('retention-total-cust'),
    retentionRepeat: document.getElementById('retention-repeat-cust'),
    
    // SQL Console
    querySelect: document.getElementById('query-select'),
    queryEditor: document.getElementById('query-editor'),
    btnRunSql: document.getElementById('btn-run-sql'),
    btnResetSql: document.getElementById('btn-reset-sql'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    queryInfoBox: document.getElementById('query-info-box'),
    queryInfoTitle: document.getElementById('query-info-title'),
    queryInfoDesc: document.getElementById('query-info-desc'),
    resultsMetaBar: document.getElementById('results-meta-bar'),
    metaTime: document.getElementById('meta-time'),
    metaRows: document.getElementById('meta-rows'),
    resultsTableContainer: document.getElementById('results-table-container'),
    consoleWelcome: document.getElementById('console-welcome'),
    consoleSpinner: document.getElementById('console-spinner'),
    tblConsoleResults: document.getElementById('tbl-console-results'),
    tblConsoleHead: document.getElementById('tbl-console-head-'), // Wait, let's fix ID
    tblConsoleHeadReal: document.getElementById('tbl-console-head'),
    tblConsoleBody: document.getElementById('tbl-console-body'),
    explainPanel: document.getElementById('results-explain-panel'),
    explainContent: document.getElementById('explain-content-text')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initSQLConsole();
    
    // Start WebAssembly SQLite Database
    await initWebAssemblyDatabase();
    
    loadDashboardData();
    
    els.btnRefresh.addEventListener('click', () => {
        loadDashboardData();
        showNotification("Data refreshed successfully");
    });
});

// Helper Formatting Functions
const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};

const formatPct = (val) => {
    return `${parseFloat(val || 0).toFixed(1)}%`;
};

const formatNum = (val) => {
    return new Intl.NumberFormat('en-US').format(val || 0);
};

// Initialize navigation
function initNavigation() {
    els.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            els.tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            els.tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === `tab-${targetTab}`) {
                    pane.classList.add('active');
                }
            });
            
            state.activeTab = targetTab;
            
            const titleMap = {
                'overview': { title: 'Executive Overview', subtitle: 'Key Performance Indicators & Enterprise Performance Analytics' },
                'products': { title: 'Products Catalog Analysis', subtitle: 'Inventory Metrics, Category Rankings & Profit Margins' },
                'customers': { title: 'Customer Behavior Analytics', subtitle: 'Customer Lifetime Values, Cohort Retention & Segment Distributions' },
                'operations': { title: 'Operations & Trends', subtitle: 'Hourly Velocities, Discounts Margins & Geographics Trends' },
                'sql-console': { title: 'SQL Query Console', subtitle: 'Run Advanced Queries Directly Against WebAssembly Index' }
            };
            
            els.pageTitle.textContent = titleMap[targetTab].title;
            els.pageSubtitle.textContent = titleMap[targetTab].subtitle;
        });
    });
}

// Initialize WebAssembly SQLite Engine
async function initWebAssemblyDatabase() {
    els.dbRecordsCount.textContent = "Initializing WASM...";
    
    const locateFile = (filename) => {
        return `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${filename}`;
    };

    try {
        if (typeof initSqlJs === 'undefined') {
            throw new Error("SQL.js WASM file could not be loaded from CDN.");
        }

        const SQL = await initSqlJs({ locateFile });
        
        // Fetch sales.db relative to path
        const res = await fetch('sales.db');
        if (!res.ok) {
            throw new Error(`Failed to load sales.db (HTTP ${res.status})`);
        }
        
        const buf = await res.arrayBuffer();
        state.db = new SQL.Database(new Uint8Array(buf));
        
        // Query transaction count to prove connection
        const countRes = runClientSqlQuery("SELECT COUNT(*) AS total FROM transactions");
        const count = countRes.data[0].total;
        
        els.dbRecordsCount.textContent = `${formatNum(count)} transactions`;
        document.querySelector('.db-status-dot').className = "db-status-dot connected";
        document.querySelector('.db-name').textContent = "SQLite WebAssembly";
        showNotification("WASM Database initialized successfully!");
        
    } catch (e) {
        console.error("WASM Database initialization error: ", e);
        state.isDemoMode = true;
        
        // Set styling for error/fallback
        document.querySelector('.db-status-dot').className = "db-status-dot";
        document.querySelector('.db-status-dot').style.backgroundColor = "var(--warning)";
        document.querySelector('.db-name').textContent = "Demo Sandbox Mode";
        
        if (window.location.protocol === 'file:') {
            els.dbRecordsCount.textContent = "CORS Error (file://)";
            showLocalCORSOverlay();
        } else {
            els.dbRecordsCount.textContent = "Failed to load database";
            showNotification("Failed to load sqlite db. Running mock fallback.", "error");
        }
        
        // Load fallback mock dataset
        loadMockDatabaseEngine();
    }
}

// Direct SQL parser/executor wrapping SQL.js format
function runClientSqlQuery(sql) {
    if (state.isDemoMode) {
        return runMockQuery(sql);
    }

    if (!state.db) {
        throw new Error("Database engine not loaded.");
    }

    const startTime = performance.now();
    const dbResult = state.db.exec(sql);
    const endTime = performance.now();
    const executionTimeMs = parseFloat((endTime - startTime).toFixed(3));

    if (dbResult.length === 0) {
        return {
            columns: [],
            data: [],
            rowCount: 0,
            executionTimeMs,
            explainPlan: []
        };
    }

    const res = dbResult[0];
    const columns = res.columns;
    const data = res.values.map(vals => {
        const row = {};
        columns.forEach((col, idx) => {
            row[col] = vals[idx];
        });
        return row;
    });

    // Explain query plan
    let explainPlan = [];
    if (sql.trim().toLowerCase().startsWith("select") || sql.trim().toLowerCase().startsWith("with")) {
        try {
            const explainRes = state.db.exec(`EXPLAIN QUERY PLAN ${sql}`);
            if (explainRes.length > 0) {
                explainPlan = explainRes[0].values.map(val => `Detail: ${val[3] || val[2]}`);
            }
        } catch (err) {
            explainPlan = ["Query plan diagnostic not supported for this structure."];
        }
    }

    return {
        columns,
        data,
        rowCount: data.length,
        executionTimeMs,
        explainPlan
    };
}

// 3. CORE DATA LOADERS
function loadDashboardData() {
    try {
        // Fetch KPIs
        const kpisData = runClientSqlQuery(QUERIES.kpis.sql);
        if (kpisData.data && kpisData.data.length > 0) {
            const kpi = kpisData.data[0];
            els.kpiOrders.textContent = formatNum(kpi.total_orders);
            els.kpiRevenue.textContent = formatCurrency(kpi.total_revenue);
            els.kpiProfit.textContent = formatCurrency(kpi.total_profit);
            els.kpiMargin.textContent = formatPct(kpi.average_profit_margin_pct);
        }

        // Render Overview Charts
        renderOverviewCharts();
        
        // Render Products Tab
        renderProductsTab();
        
        // Render Customers Tab
        renderCustomersTab();
        
        // Render Operations Tab
        renderOperationsTab();

    } catch (err) {
        console.error("Dashboard calculation error: ", err);
    }
}

// Render Overview charts
function renderOverviewCharts() {
    // Trends Chart
    const trendsData = runClientSqlQuery(QUERIES.trends.sql);
    if (trendsData.data) {
        const labels = trendsData.data.map(d => d.month);
        const revs = trendsData.data.map(d => d.monthly_revenue);
        const profits = trendsData.data.map(d => d.monthly_profit);

        if (charts.trend) charts.trend.destroy();
        charts.trend = new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Revenue ($)',
                        data: revs,
                        borderColor: '#818cf8',
                        backgroundColor: 'rgba(129, 140, 248, 0.05)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Profit ($)',
                        data: profits,
                        borderColor: '#e879f9',
                        backgroundColor: 'rgba(232, 121, 249, 0.02)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: getChartOptions('Monthly Performance ($)', false)
        });
    }

    // Category Doughnut Shares
    const catData = runClientSqlQuery(QUERIES.categories.sql);
    if (catData.data) {
        const labels = catData.data.map(d => d.category);
        const revenues = catData.data.map(d => d.total_revenue);

        if (charts.category) charts.category.destroy();
        charts.category = new Chart(document.getElementById('categoryChart'), {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: revenues,
                    backgroundColor: ['#6366f1', '#a855f7', '#ec4899', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.05)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 10 } }
                    }
                }
            }
        });
    }

    // Best Sellers Bar
    const topProd = runClientSqlQuery(QUERIES.top_products.sql);
    if (topProd.data) {
        const top5 = topProd.data.slice(0, 5);
        const labels = top5.map(d => d.product_name);
        const revenues = top5.map(d => d.total_revenue);

        if (charts.products) charts.products.destroy();
        charts.products = new Chart(document.getElementById('productsChart'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Gross Sales ($)',
                    data: revenues,
                    backgroundColor: 'rgba(99, 102, 241, 0.75)',
                    hoverBackgroundColor: '#6366f1',
                    borderRadius: 6
                }]
            },
            options: getChartOptions('Total Revenue ($)', true)
        });
    }

    // Payments preferences polarArea
    const payData = runClientSqlQuery(QUERIES.payments.sql);
    if (payData.data) {
        const labels = payData.data.map(d => d.payment_method);
        const counts = payData.data.map(d => d.transaction_count);

        if (charts.payments) charts.payments.destroy();
        charts.payments = new Chart(document.getElementById('paymentsChart'), {
            type: 'polarArea',
            data: {
                labels,
                datasets: [{
                    data: counts,
                    backgroundColor: [
                        'rgba(99, 102, 241, 0.65)',
                        'rgba(232, 121, 249, 0.65)',
                        'rgba(14, 165, 233, 0.65)',
                        'rgba(16, 185, 129, 0.65)'
                    ],
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.05)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        grid: { color: 'rgba(255, 255, 255, 0.04)' },
                        angleLines: { color: 'rgba(255, 255, 255, 0.04)' },
                        ticks: { backdropColor: 'transparent', color: '#6b7280' }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 9 } }
                    }
                }
            }
        });
    }
}

// Render Products Tab Tables
function renderProductsTab() {
    // Subcategories
    const subRes = runClientSqlQuery(QUERIES.sub_categories.sql);
    if (subRes.data) {
        els.tblSubcategories.innerHTML = '';
        subRes.data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${row.category}</strong></td>
                <td>${row.sub_category}</td>
                <td>${formatNum(row.units_sold)}</td>
                <td>${formatCurrency(row.total_revenue)}</td>
                <td>${formatCurrency(row.net_profit)}</td>
                <td><span class="badge ${row.net_margin_pct > 30 ? 'badge-success' : 'badge-primary'}">${formatPct(row.net_margin_pct)}</span></td>
            `;
            els.tblSubcategories.appendChild(tr);
        });
    }

    // Restocking
    const restockRes = runClientSqlQuery(QUERIES.restock.sql);
    if (restockRes.data) {
        els.tblRestock.innerHTML = '';
        if (restockRes.data.length === 0) {
            els.tblRestock.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Stock indices at healthy margins.</td></tr>`;
        } else {
            restockRes.data.forEach(row => {
                const statusClass = row.stock_status === 'OUT OF STOCK' ? 'badge-danger' : 
                                  row.stock_status === 'CRITICAL REORDER' ? 'badge-warning' : 'badge-info';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${row.product_name}</strong></td>
                    <td>${row.current_stock} units</td>
                    <td>${row.units_sold_last_30_days} units</td>
                    <td><span class="badge ${statusClass}">${row.stock_status}</span></td>
                `;
                els.tblRestock.appendChild(tr);
            });
        }
    }

    // Category Top Products
    const catTopRes = runClientSqlQuery(QUERIES.top_products_category.sql);
    if (catTopRes.data) {
        els.tblCatTopProducts.innerHTML = '';
        catTopRes.data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${row.category}</strong></td>
                <td><span class="badge badge-primary">Rank #${row.sales_rank}</span></td>
                <td>${row.product_name}</td>
                <td>${formatNum(row.total_sold)} units</td>
            `;
            els.tblCatTopProducts.appendChild(tr);
        });
    }
}

// Render Customers Tab details
function renderCustomersTab() {
    // Loyalty metrics
    const repRes = runClientSqlQuery(QUERIES.repeat_rate.sql);
    if (repRes.data && repRes.data.length > 0) {
        const r = repRes.data[0];
        els.retentionPct.textContent = formatPct(r.repeat_purchase_rate_pct);
        els.retentionTotal.textContent = formatNum(r.total_customers);
        els.retentionRepeat.textContent = formatNum(r.repeat_customers);
    }

    // Demographics chart
    const demoData = runClientSqlQuery(QUERIES.demographics.sql);
    if (demoData.data) {
        const ageGroups = [...new Set(demoData.data.map(d => d.age_group))].sort();
        
        const maleRevenues = ageGroups.map(age => {
            const match = demoData.data.find(d => d.age_group === age && d.gender === 'Male');
            return match ? match.total_revenue : 0;
        });
        const femaleRevenues = ageGroups.map(age => {
            const match = demoData.data.find(d => d.age_group === age && d.gender === 'Female');
            return match ? match.total_revenue : 0;
        });

        if (charts.demographics) charts.demographics.destroy();
        charts.demographics = new Chart(document.getElementById('demographicsChart'), {
            type: 'bar',
            data: {
                labels: ageGroups,
                datasets: [
                    {
                        label: 'Male ($)',
                        data: maleRevenues,
                        backgroundColor: 'rgba(14, 165, 233, 0.75)',
                        borderColor: '#0ea5e9',
                        borderWidth: 1,
                        borderRadius: 6
                    },
                    {
                        label: 'Female ($)',
                        data: femaleRevenues,
                        backgroundColor: 'rgba(217, 70, 239, 0.75)',
                        borderColor: '#d946ef',
                        borderWidth: 1,
                        borderRadius: 6
                    }
                ]
            },
            options: getChartOptions('Revenues by Gender & Age Group ($)', false)
        });
    }

    // RFM Table
    const rfmRes = runClientSqlQuery(QUERIES.rfm.sql);
    if (rfmRes.data) {
        els.tblRfm.innerHTML = '';
        rfmRes.data.forEach(row => {
            let badgeClass = 'badge-primary';
            if (row.customer_segment === 'VIP/Champions') badgeClass = 'badge-success';
            else if (row.customer_segment === 'Loyal Customers') badgeClass = 'badge-info';
            else if (row.customer_segment === 'New Customers') badgeClass = 'badge-primary';
            else if (row.customer_segment === 'At Risk / Need Attention') badgeClass = 'badge-warning';
            else if (row.customer_segment === 'Lost Customers') badgeClass = 'badge-danger';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${row.customer_name}</strong></td>
                <td>${Math.round(row.recency_days)} days</td>
                <td>${row.frequency} orders</td>
                <td>${formatCurrency(row.total_spend)}</td>
                <td><code>${row.rfm_combined_score}</code></td>
                <td><span class="badge ${badgeClass}">${row.customer_segment}</span></td>
            `;
            els.tblRfm.appendChild(tr);
        });
    }
}

// Render Operations Tab details
function renderOperationsTab() {
    // Hourly velocity chart
    const hourlyData = runClientSqlQuery(QUERIES.hourly_velocity.sql);
    if (hourlyData.data) {
        const labels = hourlyData.data.map(d => `${d.hour_of_day}:00`);
        const orders = hourlyData.data.map(d => d.total_orders);
        const revenues = hourlyData.data.map(d => d.hourly_revenue);

        if (charts.hourly) charts.hourly.destroy();
        charts.hourly = new Chart(document.getElementById('hourlyChart'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Orders Count',
                        data: orders,
                        borderColor: '#34d399',
                        backgroundColor: 'rgba(52, 211, 153, 0.05)',
                        fill: true,
                        yAxisID: 'yOrders',
                        tension: 0.3
                    },
                    {
                        label: 'Revenue ($)',
                        data: revenues,
                        borderColor: '#818cf8',
                        backgroundColor: 'transparent',
                        yAxisID: 'yRev',
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#9ca3af' } },
                    yOrders: { 
                        position: 'left',
                        grid: { color: 'rgba(255, 255, 255, 0.03)' }, 
                        ticks: { color: '#9ca3af' },
                        title: { display: true, text: 'Transaction Volume', color: '#9ca3af' }
                    },
                    yRev: { 
                        position: 'right',
                        grid: { drawOnChartArea: false }, 
                        ticks: { color: '#9ca3af' },
                        title: { display: true, text: 'Gross Income ($)', color: '#9ca3af' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#9ca3af' } }
                }
            }
        });
    }

    // Discounts Margin erosion chart
    const discData = runClientSqlQuery(QUERIES.discounts.sql);
    if (discData.data) {
        const labels = discData.data.map(d => d.discount_range);
        const sold = discData.data.map(d => d.units_sold);
        const margins = discData.data.map(d => d.profit_margin_pct);

        if (charts.discountMargin) charts.discountMargin.destroy();
        charts.discountMargin = new Chart(document.getElementById('discountMarginChart'), {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Units Sold',
                        data: sold,
                        backgroundColor: 'rgba(99, 102, 241, 0.75)',
                        borderRadius: 6,
                        yAxisID: 'yQty'
                    },
                    {
                        type: 'line',
                        label: 'Net Margin %',
                        data: margins,
                        borderColor: '#ec4899',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.2,
                        yAxisID: 'yPct'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.03)' }, ticks: { color: '#9ca3af' } },
                    yQty: {
                        position: 'left',
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { color: '#9ca3af' },
                        title: { display: true, text: 'Quantity Sold', color: '#9ca3af' }
                    },
                    yPct: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#9ca3af' },
                        title: { display: true, text: 'Margin (%)', color: '#9ca3af' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#9ca3af' } }
                }
            }
        });
    }

    // Geography table
    const geoRes = runClientSqlQuery(QUERIES.geography.sql);
    if (geoRes.data) {
        els.tblGeography.innerHTML = '';
        geoRes.data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${row.state}</strong></td>
                <td>${formatNum(row.active_customers)}</td>
                <td>${formatNum(row.total_orders)}</td>
                <td>${formatCurrency(row.total_revenue)}</td>
                <td><code>${formatCurrency(row.avg_order_value)}</code></td>
            `;
            els.tblGeography.appendChild(tr);
        });
    }

    // Returns rate table
    const retRes = runClientSqlQuery(QUERIES.returns.sql);
    if (retRes.data) {
        els.tblReturns.innerHTML = '';
        retRes.data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${row.category}</strong></td>
                <td>${formatNum(row.total_orders)}</td>
                <td>${formatNum(row.returned_orders)}</td>
                <td><span class="badge ${row.return_rate_pct > 8 ? 'badge-danger' : 'badge-success'}">${formatPct(row.return_rate_pct)}</span></td>
            `;
            els.tblReturns.appendChild(tr);
        });
    }
}

// 4. SQL CONSOLE INTERACTIVE RUNNER
function initSQLConsole() {
    // Populate dropdown with queries list
    els.querySelect.innerHTML = '<option value="" disabled selected>-- Choose an analytical query --</option>';
    Object.entries(QUERIES).forEach(([key, q]) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${q.title}`;
        els.querySelect.appendChild(opt);
    });

    els.querySelect.addEventListener('change', (e) => {
        const key = e.target.value;
        if (QUERIES[key]) {
            els.queryEditor.value = QUERIES[key].sql.trim();
            els.queryInfoTitle.textContent = QUERIES[key].title;
            els.queryInfoDesc.textContent = QUERIES[key].description;
            els.queryInfoBox.classList.remove('hidden');
        }
    });

    els.btnResetSql.addEventListener('click', () => {
        els.queryEditor.value = '';
        els.querySelect.value = '';
        els.queryInfoBox.classList.add('hidden');
    });

    els.btnRunSql.addEventListener('click', executeConsoleSqlQuery);
    els.btnExportCsv.addEventListener('click', exportConsoleResultsToCSV);

    els.explainPanel.querySelector('.explain-header').addEventListener('click', () => {
        const header = els.explainPanel.querySelector('.explain-header');
        header.classList.toggle('open');
        els.explainContent.classList.toggle('hidden');
    });
}

function executeConsoleSqlQuery() {
    const sql = els.queryEditor.value.trim();
    if (!sql) {
        showNotification("Please select or write a query first", "warning");
        return;
    }

    // UI Loading state reset
    els.consoleWelcome.classList.add('hidden');
    els.tblConsoleResults.classList.add('hidden');
    els.consoleSpinner.classList.remove('hidden');
    els.resultsMetaBar.classList.add('hidden');
    els.explainPanel.classList.add('hidden');
    els.explainContent.classList.add('hidden');
    els.explainPanel.querySelector('.explain-header').classList.remove('open');

    // Small delay to let the loading spinner render
    setTimeout(() => {
        try {
            // Security verification checks
            const cleaned = sql.toLowerCase().trim();
            if (!cleaned.startsWith("select") && !cleaned.startsWith("with")) {
                throw new Error("Security Restriction: Only SELECT or WITH query operations are supported in client runtime.");
            }
            
            const forbidden = ["insert ", "update ", "delete ", "drop ", "alter ", "create ", "replace ", "truncate "];
            if (forbidden.some(word => cleaned.includes(word))) {
                throw new Error("Security Restriction: Modifying operations (inserts, updates, deletes) are forbidden.");
            }

            const results = runClientSqlQuery(sql);

            els.consoleSpinner.classList.add('hidden');
            
            // Meta updates
            els.resultsMetaBar.classList.remove('hidden');
            els.metaTime.textContent = `${results.executionTimeMs} ms`;
            els.metaRows.textContent = results.rowCount;
            
            state.currentConsoleData = results;

            // Generate Columns Head
            els.tblConsoleHeadReal.innerHTML = '';
            const trHead = document.createElement('tr');
            results.columns.forEach(col => {
                const th = document.createElement('th');
                th.textContent = col;
                trHead.appendChild(th);
            });
            els.tblConsoleHeadReal.appendChild(trHead);

            // Generate Rows Body
            els.tblConsoleBody.innerHTML = '';
            if (results.data.length === 0) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="${results.columns.length}" style="text-align: center; color: var(--text-muted);">Query returned empty results.</td>`;
                els.tblConsoleBody.appendChild(tr);
            } else {
                results.data.forEach(row => {
                    const tr = document.createElement('tr');
                    results.columns.forEach(col => {
                        const td = document.createElement('td');
                        const val = row[col];
                        if (val === null || val === undefined) {
                            td.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">NULL</span>`;
                        } else if (typeof val === 'number' && !Number.isInteger(val)) {
                            td.textContent = val.toFixed(2);
                        } else {
                            td.textContent = val;
                        }
                        tr.appendChild(td);
                    });
                    els.tblConsoleBody.appendChild(tr);
                });
            }

            els.tblConsoleResults.classList.remove('hidden');

            // Explain plan display
            if (results.explainPlan && results.explainPlan.length > 0) {
                els.explainContent.innerHTML = results.explainPlan.join('\n');
                els.explainPanel.classList.remove('hidden');
            }

        } catch (e) {
            console.error(e);
            els.consoleSpinner.classList.add('hidden');
            els.consoleWelcome.classList.remove('hidden');
            els.consoleWelcome.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="placeholder-icon"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <h4 style="color: var(--danger-light);">SQL Query Execution Error</h4>
                <p style="color: var(--text-secondary); width: 85%; font-family: 'JetBrains Mono', monospace; font-size: 11px; background: #000; padding: 10px; border-radius: 6px; border: 1px solid rgba(255,0,0,0.2); margin-top: 10px; text-align: left; white-space: pre-wrap;">
                    ${e.message}
                </p>
            `;
            showNotification("Query failed", "error");
        }
    }, 50);
}

function exportConsoleResultsToCSV() {
    if (!state.currentConsoleData || state.currentConsoleData.data.length === 0) {
        showNotification("No data available to export", "warning");
        return;
    }

    const { columns, data } = state.currentConsoleData;
    let csvContent = columns.join(",") + "\n";
    
    data.forEach(row => {
        const rowString = columns.map(col => {
            let val = row[col];
            if (val === null || val === undefined) return '""';
            let valStr = String(val).replace(/"/g, '""');
            if (valStr.includes(',') || valStr.includes('\n') || valStr.includes('"')) {
                return `"${valStr}"`;
            }
            return valStr;
        }).join(",");
        csvContent += rowString + "\n";
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    link.setAttribute("download", `nexcart_wasm_export_${timestamp}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("CSV export downloaded successfully");
}

// Display chart configurations
function getChartOptions(yLabel, displayLegend) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                grid: { color: 'rgba(255, 255, 255, 0.03)' },
                ticks: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 10 } }
            },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.03)' },
                ticks: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 10 } },
                title: { display: !!yLabel, text: yLabel || '', color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 10 } }
            }
        },
        plugins: {
            legend: {
                display: displayLegend,
                labels: { color: '#9ca3af', font: { family: 'Plus Jakarta Sans', size: 10 } }
            }
        }
    };
}

// 5. TOAST NOTIFICATION HELPERS
function showNotification(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.backgroundColor = type === 'success' ? '#10b981' : 
                                  type === 'warning' ? '#f59e0b' : '#ef4444';
    toast.style.color = '#fff';
    toast.style.fontSize = '12px';
    toast.style.fontWeight = '600';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
    toast.style.zIndex = '9999';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    toast.textContent = message;

    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 6. CORS / PROTOCOL LOCAL ACCESS ADVISORY OVERLAY
function showLocalCORSOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'local-cors-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(4, 6, 12, 0.95)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.backdropFilter = 'blur(10px)';
    overlay.style.padding = '20px';

    overlay.innerHTML = `
        <div style="background: var(--bg-surface-solid); border: 1px solid var(--border-glass-focus); padding: 40px; border-radius: 20px; max-width: 550px; text-align: center; box-shadow: var(--shadow-glow); font-family: 'Plus Jakarta Sans', sans-serif;">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--primary-light)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 24px; filter: drop-shadow(0 0 8px var(--primary));"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            <h2 style="color: var(--text-bright); font-size: 22px; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px;">Local Browser Security Restriction</h2>
            <p style="color: var(--text-secondary); font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
                You opened this dashboard directly as a local file (<code>file:///</code> protocol). 
                Modern browsers block WebAssembly files from fetching the database <code>sales.db</code> due to security (CORS) rules.
            </p>
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-glass); border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 24px;">
                <h4 style="color: var(--primary-light); font-size: 13px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">How to Run:</h4>
                <ol style="color: var(--text-primary); font-size: 13px; padding-left: 20px; line-height: 1.6; margin: 0;">
                    <li style="margin-bottom: 6px;">
                        <strong>Deploy online:</strong> Host this folder on any web server, GitHub Pages, Netlify, or Vercel to access the URL directly as a site.
                    </li>
                    <li>
                        <strong>Run a local server:</strong> Open command prompt in this directory and launch python's standard host:
                        <code style="display:block; background:#04060c; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-glass); color:#e2e8f0; margin-top: 6px; font-family: monospace;">python -m http.server 8000</code>
                        Then go to <a href="http://localhost:8000" style="color: var(--info-light); text-decoration: underline;">http://localhost:8000</a>.
                    </li>
                </ol>
            </div>
            <button id="btn-overlay-demo" class="btn btn-primary" style="padding: 12px 24px; font-size: 14px;">
                Load Sandbox Mode (Mock Data)
            </button>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('btn-overlay-demo').addEventListener('click', () => {
        overlay.remove();
        showNotification("Loaded Demo Sandbox Mode with mock dataset.");
    });
}

// 7. SANDBOX FALLBACK MOCK DATA ENGINE
let mockDb = {};

function loadMockDatabaseEngine() {
    // Populate simple mock aggregated records to let the dashboard render beautifully even without the DB fetch
    mockDb = {
        kpis: [{
            total_orders: 22500,
            total_items_sold: 43250,
            total_revenue: 1658420.50,
            total_cost: 1045230.10,
            total_profit: 613190.40,
            average_profit_margin_pct: 36.97
        }],
        trends: [
            { month: "2024-01", order_count: 750, monthly_revenue: 55000.0, monthly_profit: 19800.0 },
            { month: "2024-02", order_count: 720, monthly_revenue: 51200.0, monthly_profit: 18200.0 },
            { month: "2024-03", order_count: 850, monthly_revenue: 61000.0, monthly_profit: 22000.0 },
            { month: "2024-04", order_count: 880, monthly_revenue: 63500.0, monthly_profit: 23100.0 },
            { month: "2024-05", order_count: 910, monthly_revenue: 67000.0, monthly_profit: 24500.0 },
            { month: "2024-06", order_count: 950, monthly_revenue: 71000.0, monthly_profit: 26000.0 },
            { month: "2024-07", order_count: 920, monthly_revenue: 68500.0, monthly_profit: 25100.0 },
            { month: "2024-08", order_count: 1050, monthly_revenue: 78000.0, monthly_profit: 29000.0 },
            { month: "2024-09", order_count: 1100, monthly_revenue: 83500.0, monthly_profit: 31200.0 },
            { month: "2024-10", order_count: 1020, monthly_revenue: 76000.0, monthly_profit: 28100.0 },
            { month: "2024-11", order_count: 1750, monthly_revenue: 135000.0, monthly_profit: 49800.0 },
            { month: "2024-12", order_count: 2200, monthly_revenue: 168000.0, monthly_profit: 62000.0 },
            { month: "2025-01", order_count: 810, monthly_revenue: 59000.0, monthly_profit: 21500.0 },
            { month: "2025-02", order_count: 790, monthly_revenue: 57500.0, monthly_profit: 21000.0 },
            { month: "2025-03", order_count: 960, monthly_revenue: 71000.0, monthly_profit: 26200.0 },
            { month: "2025-04", order_count: 980, monthly_revenue: 73000.0, monthly_profit: 27100.0 },
            { month: "2025-05", order_count: 1050, monthly_revenue: 79500.0, monthly_profit: 29500.0 },
            { month: "2025-06", order_count: 1110, monthly_revenue: 84000.0, monthly_profit: 31200.0 },
            { month: "2025-07", order_count: 1080, monthly_revenue: 81500.0, monthly_profit: 30100.0 },
            { month: "2025-08", order_count: 1210, monthly_revenue: 91500.0, monthly_profit: 34200.0 },
            { month: "2025-09", order_count: 1250, monthly_revenue: 94000.0, monthly_profit: 35100.0 },
            { month: "2025-10", order_count: 1150, monthly_revenue: 87000.0, monthly_profit: 32300.0 },
            { month: "2025-11", order_count: 2100, monthly_revenue: 159000.0, monthly_profit: 59000.0 },
            { month: "2025-12", order_count: 2600, monthly_revenue: 198000.0, monthly_profit: 73500.0 }
        ],
        categories: [
            { category: "Electronics", unique_products_sold: 12, total_quantity: 4500, total_revenue: 685240.20, total_profit: 245300.10, profit_margin_pct: 35.8 },
            { category: "Home & Kitchen", unique_products_sold: 10, total_quantity: 5800, total_revenue: 342150.80, total_profit: 132450.20, profit_margin_pct: 38.7 },
            { category: "Clothing", unique_products_sold: 11, total_quantity: 8200, total_revenue: 298450.10, total_profit: 112140.50, profit_margin_pct: 37.6 },
            { category: "Sports & Outdoors", unique_products_sold: 7, total_quantity: 3600, total_revenue: 185120.40, total_profit: 69450.30, profit_margin_pct: 37.5 },
            { category: "Beauty", unique_products_sold: 10, total_quantity: 4800, total_revenue: 105420.60, total_profit: 38500.10, profit_margin_pct: 36.5 },
            { category: "Books", unique_products_sold: 11, total_quantity: 6300, total_revenue: 42038.40, total_profit: 15349.20, profit_margin_pct: 36.5 }
        ],
        top_products: [
            { product_id: 5, product_name: "MacBook Air M3", category: "Electronics", total_quantity_sold: 380, total_revenue: 417620.00, total_profit: 132620.00 },
            { product_id: 1, product_name: "iPhone 15", category: "Electronics", total_quantity_sold: 450, total_revenue: 359550.00, total_profit: 112050.00 },
            { product_id: 15, product_name: "Robot Vacuum", category: "Home & Kitchen", total_quantity_sold: 620, total_revenue: 185993.80, total_profit: 80600.00 },
            { product_id: 2, product_name: "Samsung Galaxy S24", category: "Electronics", total_quantity_sold: 210, total_revenue: 188790.00, total_profit: 58590.00 },
            { product_id: 13, product_name: "Air Fryer XL", category: "Home & Kitchen", total_quantity_sold: 850, total_revenue: 101991.50, total_profit: 46750.00 }
        ],
        payments: [
            { payment_method: "Credit Card", transaction_count: 10250, total_revenue: 765230.10, avg_transaction_amount: 74.65 },
            { payment_method: "PayPal", transaction_count: 6150, total_revenue: 442150.50, avg_transaction_amount: 71.89 },
            { payment_method: "Debit Card", transaction_count: 4200, total_revenue: 302140.20, avg_transaction_amount: 71.93 },
            { payment_method: "Crypto", transaction_count: 1900, total_revenue: 148899.70, avg_transaction_amount: 78.36 }
        ],
        sub_categories: [
            { category: "Electronics", sub_category: "Laptops", units_sold: 950, total_revenue: 854200.00, net_profit: 298400.00, net_margin_pct: 34.9 },
            { category: "Electronics", sub_category: "Phones", units_sold: 1250, total_revenue: 698500.00, net_profit: 245600.00, net_margin_pct: 35.1 },
            { category: "Home & Kitchen", sub_category: "Appliances", units_sold: 2200, total_revenue: 384500.00, net_profit: 142100.00, net_margin_pct: 36.9 },
            { category: "Clothing", sub_category: "Men's Apparel", units_sold: 3800, total_revenue: 154200.00, net_profit: 61800.00, net_margin_pct: 40.1 },
            { category: "Clothing", sub_category: "Women's Apparel", units_sold: 4100, total_revenue: 125600.00, net_profit: 51200.00, net_margin_pct: 40.7 }
        ],
        restock: [
            { product_name: "iPhone 15", current_stock: 4, units_sold_last_30_days: 35, stock_status: "CRITICAL REORDER" },
            { product_name: "Air Fryer XL", current_stock: 8, units_sold_last_30_days: 62, stock_status: "LOW STOCK" },
            { product_name: "Mechanical Keyboard", current_stock: 0, units_sold_last_30_days: 18, stock_status: "OUT OF STOCK" }
        ],
        top_products_category: [
            { category: "Electronics", sales_rank: 1, product_name: "MacBook Air M3", total_sold: 380 },
            { category: "Electronics", sales_rank: 2, product_name: "iPhone 15", total_sold: 450 },
            { category: "Home & Kitchen", sales_rank: 1, product_name: "Robot Vacuum", total_sold: 620 }
        ],
        repeat_rate: [{
            total_customers: 1200,
            repeat_customers: 654,
            repeat_purchase_rate_pct: 54.50
        }],
        demographics: [
            { age_group: "18-24", gender: "Male", total_revenue: 120000.00 },
            { age_group: "18-24", gender: "Female", total_revenue: 145000.00 },
            { age_group: "25-34", gender: "Male", total_revenue: 285000.00 },
            { age_group: "25-34", gender: "Female", total_revenue: 310000.00 },
            { age_group: "35-44", gender: "Male", total_revenue: 220000.00 },
            { age_group: "35-44", gender: "Female", total_revenue: 245000.00 },
            { age_group: "45-54", gender: "Male", total_revenue: 165000.00 },
            { age_group: "45-54", gender: "Female", total_revenue: 178000.00 }
        ],
        rfm: [
            { customer_name: "Robert Smith", recency_days: 3, frequency: 12, total_spend: 3450.50, rfm_combined_score: "5-5-5", customer_segment: "VIP/Champions" },
            { customer_name: "Jennifer Davis", recency_days: 6, frequency: 10, total_spend: 2980.20, rfm_combined_score: "5-5-5", customer_segment: "VIP/Champions" },
            { customer_name: "James Miller", recency_days: 14, frequency: 8, total_spend: 1850.40, rfm_combined_score: "4-4-4", customer_segment: "Loyal Customers" },
            { customer_name: "Patricia Johnson", recency_days: 90, frequency: 1, total_spend: 129.99, rfm_combined_score: "2-1-2", customer_segment: "At Risk / Need Attention" }
        ],
        hourly_velocity: [
            { hour_of_day: "08", total_orders: 450, hourly_revenue: 32000.0 },
            { hour_of_day: "12", total_orders: 1250, hourly_revenue: 95000.0 },
            { hour_of_day: "18", total_orders: 2200, hourly_revenue: 165000.0 },
            { hour_of_day: "20", total_orders: 2600, hourly_revenue: 198000.0 }
        ],
        discounts: [
            { discount_range: "No Discount (0%)", units_sold: 18500, profit_margin_pct: 42.1 },
            { discount_range: "Low Discount (1-10%)", units_sold: 4500, profit_margin_pct: 35.8 },
            { discount_range: "Medium Discount (11-20%)", units_sold: 2200, profit_margin_pct: 28.5 },
            { discount_range: "High Discount (21%+)", units_sold: 900, profit_margin_pct: 19.3 }
        ],
        geography: [
            { state: "California", active_customers: 250, total_orders: 4500, total_revenue: 325400.00, avg_order_value: 72.31 },
            { state: "Texas", active_customers: 180, total_orders: 3200, total_revenue: 225100.00, avg_order_value: 70.34 },
            { state: "New York", active_customers: 165, total_orders: 2800, total_revenue: 210450.00, avg_order_value: 75.16 }
        ],
        returns: [
            { category: "Clothing", total_orders: 8200, returned_orders: 780, return_rate_pct: 9.51 },
            { category: "Electronics", total_orders: 4500, returned_orders: 210, return_rate_pct: 4.67 },
            { category: "Beauty", total_orders: 4800, returned_orders: 120, return_rate_pct: 2.50 }
        ]
    };
}

function runMockQuery(sql) {
    const cleaned = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    
    // Map SQL queries to mock db outputs
    let key = "kpis";
    if (cleaned.includes("strftime('%y-%m'") || cleaned.includes("monthly_revenue")) key = "trends";
    else if (cleaned.includes("p.category") && cleaned.includes("sub_category")) key = "sub_categories";
    else if (cleaned.includes("p.category")) {
        if (cleaned.includes("returned_orders")) key = "returns";
        else key = "categories";
    }
    else if (cleaned.includes("stock_status")) key = "restock";
    else if (cleaned.includes("sales_rank")) key = "top_products_category";
    else if (cleaned.includes("repeat_purchase_rate_pct")) key = "repeat_rate";
    else if (cleaned.includes("customer_segment")) key = "rfm";
    else if (cleaned.includes("hour_of_day")) key = "hourly_velocity";
    else if (cleaned.includes("discount_range")) key = "discounts";
    else if (cleaned.includes("c.location")) key = "geography";
    else if (cleaned.includes("payment_method")) key = "payments";
    else if (cleaned.includes("product_name")) key = "top_products";
    
    const mockData = mockDb[key] || [];
    const columns = mockData.length > 0 ? Object.keys(mockData[0]) : [];
    
    return {
        columns,
        data: mockData,
        rowCount: mockData.length,
        executionTimeMs: 0.12,
        explainPlan: ["Running in sandboxed mock demonstration engine."]
    };
}
