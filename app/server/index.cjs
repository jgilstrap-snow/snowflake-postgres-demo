const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const dataGen = require('./dataGenerator.cjs');

const app = express();
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
}

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT || 5432,
  database: process.env.PG_DATABASE || 'ecommerce',
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

let vipCustomerIds = [];
let backgroundTrafficInterval = null;
let backgroundTrafficStats = { running: false, opsPerSec: 0, totalOps: 0, startedAt: null };

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/readiness', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', timestamp: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/customers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY id DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  let { email, first_name, last_name } = req.body || {};
  if (!email || !first_name || !last_name) {
    const customer = dataGen.generateCustomer();
    email = customer.email;
    first_name = customer.first_name;
    last_name = customer.last_name;
  }
  try {
    const result = await pool.query(
      'INSERT INTO customers (email, first_name, last_name) VALUES ($1, $2, $3) RETURNING *',
      [email, first_name, last_name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  const { email, first_name, last_name } = req.body;
  try {
    const result = await pool.query(
      'UPDATE customers SET email = $1, first_name = $2, last_name = $3, updated_at = NOW() WHERE id = $4 RETURNING *',
      [email, first_name, last_name, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM customers WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  let { sku, name, description, price, inventory_count } = req.body || {};
  if (!sku || !name) {
    const product = dataGen.selectProductWithCategoryBias();
    sku = product.sku + '-' + Date.now();
    name = product.name;
    description = product.description;
    price = product.price;
    inventory_count = product.inventory_count;
  }
  try {
    const result = await pool.query(
      'INSERT INTO products (sku, name, description, price, inventory_count) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [sku, name, description, price, inventory_count]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { sku, name, description, price, inventory_count } = req.body;
  try {
    const result = await pool.query(
      'UPDATE products SET sku = $1, name = $2, description = $3, price = $4, inventory_count = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
      [sku, name, description, price, inventory_count, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, c.first_name, c.last_name, c.email as customer_email
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY o.id DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  const { customer_id, items } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    let total = 0;
    for (const item of items) {
      const product = await client.query('SELECT price FROM products WHERE id = $1', [item.product_id]);
      total += product.rows[0].price * item.quantity;
    }
    
    const orderResult = await client.query(
      'INSERT INTO orders (customer_id, status, total_amount) VALUES ($1, $2, $3) RETURNING *',
      [customer_id, 'pending', total]
    );
    const order = orderResult.rows[0];
    
    for (const item of items) {
      const product = await client.query('SELECT price FROM products WHERE id = $1', [item.product_id]);
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
        [order.id, item.product_id, item.quantity, product.rows[0].price]
      );
      await client.query(
        'UPDATE products SET inventory_count = inventory_count - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }
    
    await client.query('COMMIT');
    res.json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM customers) as customer_count,
        (SELECT COUNT(*) FROM products) as product_count,
        (SELECT COUNT(*) FROM orders) as order_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status = 'completed') as total_revenue
    `);
    res.json(stats.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/seed', async (req, res) => {
  const { days = 30, customersCount = 100 } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE TABLE order_items, orders, customers, products RESTART IDENTITY CASCADE');
    
    console.log('Seeding products...');
    const allProducts = dataGen.getAllProducts();
    const productIds = [];
    for (const product of allProducts) {
      const result = await client.query(
        'INSERT INTO products (sku, name, description, price, inventory_count) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [product.sku, product.name, product.description, product.price, product.inventory_count]
      );
      productIds.push({ id: result.rows[0].id, sku: product.sku, price: product.price });
    }
    console.log('Seeded ' + productIds.length + ' products');
    
    console.log('Seeding customers...');
    const customerPool = dataGen.generateCustomerPool(customersCount);
    const customerIds = [];
    for (const customer of customerPool) {
      const result = await client.query(
        'INSERT INTO customers (email, first_name, last_name) VALUES ($1, $2, $3) RETURNING id',
        [customer.email, customer.first_name, customer.last_name]
      );
      customerIds.push(result.rows[0].id);
    }
    console.log('Seeded ' + customerIds.length + ' customers');
    
    vipCustomerIds = customerIds.slice(0, dataGen.VIP_CUSTOMER_COUNT);
    dataGen.setVipCustomers(vipCustomerIds);
    
    const targetOrders = Math.min(days * 25, 1500);
    console.log('Generating ' + targetOrders + ' orders...');
    let totalOrders = 0;
    
    for (let i = 0; i < targetOrders; i++) {
      const dayOffset = Math.floor(Math.random() * days);
      const customerId = dataGen.selectCustomerIdWithVipBias(customerIds);
      const product = dataGen.selectProductWithCategoryBias();
      const productRecord = productIds.find(p => p.sku === product.sku);
      if (!productRecord) continue;
      
      const quantity = Math.floor(Math.random() * 3) + 1;
      const total = productRecord.price * quantity;
      const status = dataGen.getOrderStatus();
      const orderTimestamp = dataGen.generateHistoricalOrderTimestamp(dayOffset);
      
      const orderResult = await client.query(
        'INSERT INTO orders (customer_id, status, total_amount, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
        [customerId, status, total, orderTimestamp.date]
      );
      
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, created_at) VALUES ($1, $2, $3, $4, $5)',
        [orderResult.rows[0].id, productRecord.id, quantity, productRecord.price, orderTimestamp.date]
      );
      totalOrders++;
    }
    
    await client.query('COMMIT');
    res.json({
      success: true,
      stats: { products: productIds.length, customers: customerIds.length, vipCustomers: vipCustomerIds.length, orders: totalOrders, daysOfHistory: days }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post('/api/simulate/traffic', async (req, res) => {
  const { operations = 10 } = req.body;
  const results = { created: 0, updated: 0, errors: [] };
  
  for (let i = 0; i < operations; i++) {
    try {
      const action = Math.random();
      if (action < 0.5) {
        const customer = dataGen.generateCustomer();
        await pool.query(
          'INSERT INTO customers (email, first_name, last_name) VALUES ($1, $2, $3)',
          [customer.email, customer.first_name, customer.last_name]
        );
        results.created++;
      } else {
        await pool.query(
          'UPDATE products SET inventory_count = inventory_count + $1 WHERE id = $2',
          [Math.floor(Math.random() * 10), Math.floor(Math.random() * 10) + 1]
        );
        results.updated++;
      }
    } catch (err) {
      results.errors.push(err.message);
    }
  }
  
  res.json(results);
});

app.post('/api/simulate/burst', async (req, res) => {
  const { count = 5 } = req.body;
  const operations = [];
  const opTypes = [
    'INSERT_CUSTOMER',
    'INSERT_ORDER',
    'INSERT_ORDER',
    'INSERT_ORDER',
    'SELECT',
    'UPDATE_INVENTORY',
    'UPDATE_ORDER_STATUS'
  ];
  
  const allCustomerIds = await pool.query('SELECT id FROM customers');
  const allProductIds = await pool.query('SELECT id, price, name FROM products');
  
  if (allCustomerIds.rows.length === 0 || allProductIds.rows.length === 0) {
    return res.status(400).json({ error: 'Please seed the database first using POST /api/seed' });
  }
  
  const customerIdList = allCustomerIds.rows.map(r => r.id);
  
  for (let i = 0; i < count; i++) {
    const opType = opTypes[Math.floor(Math.random() * opTypes.length)];
    const start = Date.now();
    let displayType = opType.startsWith('INSERT') ? 'INSERT' : 
                      opType.startsWith('UPDATE') ? 'UPDATE' : 
                      opType.startsWith('SELECT') ? 'SELECT' : 'ORDER';
    let detail = '';
    
    try {
      switch (opType) {
        case 'INSERT_CUSTOMER':
          const customer = dataGen.generateCustomer();
          const newCust = await pool.query(
            'INSERT INTO customers (email, first_name, last_name) VALUES ($1, $2, $3) RETURNING id',
            [customer.email, customer.first_name, customer.last_name]
          );
          customerIdList.push(newCust.rows[0].id);
          detail = `${customer.first_name} ${customer.last_name}`;
          break;
          
        case 'INSERT_ORDER':
          const customerId = dataGen.selectCustomerIdWithVipBias(customerIdList);
          const product = dataGen.selectProductWithCategoryBias();
          const productRecord = allProductIds.rows.find(p => p.name.includes(product.name.split(' ')[0])) || 
                               allProductIds.rows[Math.floor(Math.random() * allProductIds.rows.length)];
          
          const quantity = Math.floor(Math.random() * 3) + 1;
          const total = parseFloat(productRecord.price) * quantity;
          const status = dataGen.getOrderStatus();
          
          const orderResult = await pool.query(
            'INSERT INTO orders (customer_id, status, total_amount) VALUES ($1, $2, $3) RETURNING id',
            [customerId, status, total]
          );
          
          await pool.query(
            'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
            [orderResult.rows[0].id, productRecord.id, quantity, productRecord.price]
          );
          detail = `$${total.toFixed(2)} (${status})`;
          break;
          
        case 'SELECT':
          const queries = [
            'SELECT COUNT(*) FROM customers',
            'SELECT COUNT(*) FROM products', 
            'SELECT COUNT(*) FROM orders',
            'SELECT SUM(total_amount) FROM orders WHERE status = \'completed\''
          ];
          await pool.query(queries[Math.floor(Math.random() * queries.length)]);
          detail = 'query';
          break;
          
        case 'UPDATE_INVENTORY':
          await pool.query(
            'UPDATE products SET inventory_count = inventory_count + $1 WHERE id = (SELECT id FROM products ORDER BY RANDOM() LIMIT 1) RETURNING id',
            [Math.floor(Math.random() * 20) + 1]
          );
          detail = 'inventory';
          break;
          
        case 'UPDATE_ORDER_STATUS':
          const statuses = ['pending', 'shipped', 'completed'];
          const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
          await pool.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = (SELECT id FROM orders ORDER BY RANDOM() LIMIT 1) RETURNING id',
            [newStatus]
          );
          detail = newStatus;
          break;
      }
      
      operations.push({
        type: displayType,
        detail,
        duration: Date.now() - start,
        success: true,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      operations.push({
        type: displayType,
        detail,
        duration: Date.now() - start,
        success: false,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  res.json({ operations });
});

async function runSingleBackgroundOp() {
  const opTypes = ['INSERT_CUSTOMER', 'INSERT_ORDER', 'INSERT_ORDER', 'INSERT_ORDER', 'SELECT', 'UPDATE_INVENTORY', 'UPDATE_ORDER_STATUS'];
  const opType = opTypes[Math.floor(Math.random() * opTypes.length)];
  
  try {
    const allCustomerIds = await pool.query('SELECT id FROM customers');
    const allProductIds = await pool.query('SELECT id, price, name FROM products');
    
    if (allCustomerIds.rows.length === 0 || allProductIds.rows.length === 0) return;
    
    const customerIdList = allCustomerIds.rows.map(r => r.id);
    
    switch (opType) {
      case 'INSERT_CUSTOMER':
        const customer = dataGen.generateCustomer();
        await pool.query('INSERT INTO customers (email, first_name, last_name) VALUES ($1, $2, $3)', [customer.email, customer.first_name, customer.last_name]);
        break;
      case 'INSERT_ORDER':
        const customerId = dataGen.selectCustomerIdWithVipBias(customerIdList);
        const product = dataGen.selectProductWithCategoryBias();
        const productRecord = allProductIds.rows.find(p => p.name.includes(product.name.split(' ')[0])) || allProductIds.rows[Math.floor(Math.random() * allProductIds.rows.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;
        const total = parseFloat(productRecord.price) * quantity;
        const status = dataGen.getOrderStatus();
        const orderResult = await pool.query('INSERT INTO orders (customer_id, status, total_amount) VALUES ($1, $2, $3) RETURNING id', [customerId, status, total]);
        await pool.query('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)', [orderResult.rows[0].id, productRecord.id, quantity, productRecord.price]);
        break;
      case 'SELECT':
        await pool.query('SELECT COUNT(*) FROM orders');
        break;
      case 'UPDATE_INVENTORY':
        await pool.query('UPDATE products SET inventory_count = inventory_count + $1 WHERE id = (SELECT id FROM products ORDER BY RANDOM() LIMIT 1)', [Math.floor(Math.random() * 20) + 1]);
        break;
      case 'UPDATE_ORDER_STATUS':
        const statuses = ['pending', 'shipped', 'completed'];
        await pool.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = (SELECT id FROM orders ORDER BY RANDOM() LIMIT 1)', [statuses[Math.floor(Math.random() * statuses.length)]]);
        break;
    }
    backgroundTrafficStats.totalOps++;
  } catch (err) {
    console.error('Background op error:', err.message);
  }
}

app.post('/api/background/start', (req, res) => {
  const { opsPerSec = 2 } = req.body || {};
  
  if (backgroundTrafficInterval) {
    return res.json({ message: 'Already running', ...backgroundTrafficStats });
  }
  
  const delay = Math.max(100, 1000 / opsPerSec);
  backgroundTrafficStats = { running: true, opsPerSec, totalOps: 0, startedAt: new Date().toISOString() };
  
  backgroundTrafficInterval = setInterval(runSingleBackgroundOp, delay);
  console.log(`Background traffic started: ${opsPerSec} ops/sec`);
  
  res.json({ message: 'Background traffic started', ...backgroundTrafficStats });
});

app.post('/api/background/stop', (req, res) => {
  if (backgroundTrafficInterval) {
    clearInterval(backgroundTrafficInterval);
    backgroundTrafficInterval = null;
  }
  
  const finalStats = { ...backgroundTrafficStats, running: false, stoppedAt: new Date().toISOString() };
  backgroundTrafficStats = { running: false, opsPerSec: 0, totalOps: 0, startedAt: null };
  
  console.log('Background traffic stopped');
  res.json({ message: 'Background traffic stopped', ...finalStats });
});

app.get('/api/background/status', (req, res) => {
  res.json(backgroundTrafficStats);
});

app.delete('/api/reset', async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE order_items, orders, customers, products RESTART IDENTITY CASCADE');
    vipCustomerIds = [];
    res.json({ success: true, message: 'All data cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/monitor', async (req, res) => {
  try {
    const [
      connections,
      dbStats,
      tableStats,
      activeQueries,
      dbSize,
      poolStats
    ] = await Promise.all([
      pool.query(`
        SELECT count(*) as total,
               count(*) FILTER (WHERE state = 'active') as active,
               count(*) FILTER (WHERE state = 'idle') as idle,
               count(*) FILTER (WHERE wait_event IS NOT NULL) as waiting
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `),
      pool.query(`
        SELECT xact_commit, xact_rollback, 
               blks_read, blks_hit,
               tup_returned, tup_fetched, tup_inserted, tup_updated, tup_deleted,
               conflicts, deadlocks,
               CASE WHEN blks_read + blks_hit > 0 
                    THEN round(100.0 * blks_hit / (blks_read + blks_hit), 2)
                    ELSE 100 END as cache_hit_ratio
        FROM pg_stat_database 
        WHERE datname = current_database()
      `),
      pool.query(`
        SELECT relname as table_name,
               n_live_tup as row_count,
               n_tup_ins as inserts,
               n_tup_upd as updates,
               n_tup_del as deletes,
               seq_scan,
               idx_scan
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC
      `),
      pool.query(`
        SELECT pid, state, query, 
               EXTRACT(EPOCH FROM (now() - query_start))::numeric(10,2) as duration_sec,
               wait_event_type, wait_event
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND state = 'active'
          AND pid != pg_backend_pid()
        ORDER BY query_start
        LIMIT 10
      `),
      pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`),
      Promise.resolve({ rows: [{ total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount }] })
    ]);

    res.json({
      connections: connections.rows[0],
      database: {
        ...dbStats.rows[0],
        size: dbSize.rows[0].size
      },
      tables: tableStats.rows,
      activeQueries: activeQueries.rows,
      pool: poolStats.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV === 'production') {
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
