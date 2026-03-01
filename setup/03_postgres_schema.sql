-- =============================================================================
-- Snowflake Postgres Demo: E-commerce Schema & Seed Data
-- =============================================================================
-- Run this in your Postgres client (DBeaver, psql) connected to Snowflake Postgres
-- Connect as: snowflake_admin
-- =============================================================================

-- Create demo database
CREATE DATABASE ecommerce;

-- Create application user with replication privileges (for CDC)
CREATE USER app_user WITH PASSWORD 'ChangeMe123!' REPLICATION;
GRANT ALL PRIVILEGES ON DATABASE ecommerce TO app_user;

-- Connect to ecommerce database, then run the rest
\c ecommerce

-- Grant schema privileges to app_user
GRANT ALL ON SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;

-- =============================================================================
-- Tables
-- =============================================================================

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    inventory_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Indexes for performance
-- =============================================================================

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- =============================================================================
-- Seed Data: Products
-- =============================================================================

INSERT INTO products (sku, name, description, price, inventory_count) VALUES
    ('LAPTOP-001', 'Pro Laptop 15"', 'High-performance laptop with 16GB RAM', 1299.99, 50),
    ('LAPTOP-002', 'Ultra Laptop 13"', 'Lightweight laptop for productivity', 999.99, 75),
    ('PHONE-001', 'SmartPhone X', 'Latest smartphone with 128GB storage', 899.99, 200),
    ('PHONE-002', 'SmartPhone SE', 'Budget-friendly smartphone', 499.99, 300),
    ('TABLET-001', 'Pro Tablet 12"', 'Professional tablet with stylus support', 799.99, 100),
    ('HEADPHONES-001', 'Wireless Pro Headphones', 'Noise-canceling wireless headphones', 349.99, 150),
    ('HEADPHONES-002', 'Sport Earbuds', 'Water-resistant wireless earbuds', 149.99, 400),
    ('WATCH-001', 'Smart Watch Pro', 'Fitness tracking smartwatch', 399.99, 120),
    ('CHARGER-001', 'Fast Charger USB-C', '65W USB-C fast charger', 49.99, 500),
    ('CASE-001', 'Laptop Sleeve 15"', 'Protective laptop sleeve', 39.99, 250);

-- =============================================================================
-- Seed Data: Customers
-- =============================================================================

INSERT INTO customers (email, first_name, last_name) VALUES
    ('john.doe@example.com', 'John', 'Doe'),
    ('jane.smith@example.com', 'Jane', 'Smith'),
    ('bob.wilson@example.com', 'Bob', 'Wilson'),
    ('alice.johnson@example.com', 'Alice', 'Johnson'),
    ('charlie.brown@example.com', 'Charlie', 'Brown');

-- =============================================================================
-- Seed Data: Sample Orders
-- =============================================================================

INSERT INTO orders (customer_id, status, total_amount) VALUES
    (1, 'completed', 1349.98),
    (2, 'completed', 1299.98),
    (3, 'pending', 899.99),
    (1, 'shipped', 499.98);

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1, 1, 1, 1299.99),
    (1, 9, 1, 49.99),
    (2, 3, 1, 899.99),
    (2, 8, 1, 399.99),
    (3, 3, 1, 899.99),
    (4, 6, 1, 349.99),
    (4, 7, 1, 149.99);

-- =============================================================================
-- Verify
-- =============================================================================

SELECT 'Products' as table_name, COUNT(*) as row_count FROM products
UNION ALL
SELECT 'Customers', COUNT(*) FROM customers
UNION ALL
SELECT 'Orders', COUNT(*) FROM orders
UNION ALL
SELECT 'Order Items', COUNT(*) FROM order_items;
