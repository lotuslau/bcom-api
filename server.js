const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Allow your React app (port 5173) to connect
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Test route — visit http://localhost:3001/api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'B-Com API is running!' });
});

// Import route files
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sellers', require('./routes/sellers'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reviews', require('./routes/reviews'));
app.get('/api/customers', async (req, res) => {
  try {
    const db = require('./db/index');
    const result = await db.query(
      `SELECT id, name, email, phone, address, district, created_at 
       FROM customers ORDER BY created_at DESC`
    );
    res.json({ customers: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin stats route
app.get('/api/admin/stats', async (req, res) => {
  try {
    const db = require('./db/index');
    const [revenue, orders, customers, products] = await Promise.all([
      db.query(`SELECT COALESCE(SUM(total_bzd), 0) as total_revenue FROM orders WHERE status != 'cancelled'`),
      db.query(`SELECT COUNT(*) as total_orders FROM orders`),
      db.query(`SELECT COUNT(*) as total_customers FROM customers`),
      db.query(`SELECT COUNT(*) as total_products FROM products WHERE is_active = true`)
    ]);
    res.json({
      total_revenue: revenue.rows[0].total_revenue,
      total_orders: orders.rows[0].total_orders,
      total_customers: customers.rows[0].total_customers,
      total_products: products.rows[0].total_products
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin all reviews route
app.get('/api/admin/reviews', async (req, res) => {
  try {
    const db = require('./db/index');
    const result = await db.query(
      `SELECT * FROM reviews ORDER BY created_at DESC`
    );
    res.json({ reviews: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin all payments route
app.get('/api/admin/payments', async (req, res) => {
  try {
    const db = require('./db/index');
    const result = await db.query(
      `SELECT * FROM payments ORDER BY created_at DESC`
    );
    res.json({ payments: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});