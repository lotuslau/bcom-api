// ============================================================
// B-COM BELIZE — Secure Server
// ============================================================
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// xss-clean removed — deprecated and conflicts with Node 24
const hpp = require('hpp');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

// 1 — HELMET: Sets secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "*.cloudinary.com"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "http://localhost:5173", "http://localhost:5174"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// 2 — CORS: Only allow your frontend
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://bcombelize.vercel.app',
  process.env.FRONTEND_URL,
  process.env.VITE_API_URL,
].filter(Boolean);

const normalizeOrigin = (value) => value ? value.replace(/\/+$/, '') : value;
const normalizedAllowedOrigins = allowedOrigins.map(normalizeOrigin);

app.use(cors({
  origin: (origin, callback) => {
    const normalizedOrigin = normalizeOrigin(origin);

    if (!origin || normalizedAllowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
  credentials: true,
  optionsSuccessStatus: 204
}));

// 3 — RATE LIMITING: Prevent brute force attacks
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per 15 min per IP
  message: {
    error: 'Too many requests from this IP. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// 4 — STRICT RATE LIMIT for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

// 5 — STRICT RATE LIMIT for orders
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // max 20 orders per hour per IP
  message: {
    error: 'Too many orders from this IP. Please contact us via WhatsApp.'
  }
});

// 6 — XSS PROTECTION: Disabled xss-clean (deprecated)
// Using helmet and input validation instead

// 7 — HTTP PARAMETER POLLUTION prevention
app.use(hpp());

// 8 — REQUEST SIZE LIMIT: Prevent large payload attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 9 — SECURITY HEADERS: Additional protection
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// 10 — REQUEST LOGGER
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} — IP: ${req.ip}`);
  next();
});

// ============================================================
// ROUTES
// ============================================================

// Health check — public
app.get('/api/health', (req, res) => {
  res.json({
    status: 'B-Com API is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Apply auth rate limiter to auth routes
app.use('/api/auth', authLimiter, require('./routes/auth'));

// Apply order rate limiter to orders
app.use('/api/orders', orderLimiter, require('./routes/orders'));

// Standard routes
app.use('/api/products', require('./routes/products'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/wishlist', require('./routes/wishlist'));
/*app.use('/api/sellers', require('./routes/sellers'));*/

// ============================================================
// ADMIN ROUTES — Extra protection
// ============================================================
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many admin requests' }
});

const adminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Admin stats
app.get('/api/admin/stats', adminLimiter, adminAuth, async (req, res) => {
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
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin reviews
app.get('/api/admin/reviews', adminLimiter, adminAuth, async (req, res) => {
  try {
    const db = require('./db/index');
    const result = await db.query(
      `SELECT * FROM reviews ORDER BY created_at DESC`
    );
    res.json({ reviews: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin payments
app.get('/api/admin/payments', adminLimiter, adminAuth, async (req, res) => {
  try {
    const db = require('./db/index');
    const result = await db.query(
      `SELECT * FROM payments ORDER BY created_at DESC`
    );
    res.json({ payments: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Customers route
app.get('/api/customers', adminLimiter, adminAuth, async (req, res) => {
  try {
    const db = require('./db/index');
    const result = await db.query(
      `SELECT id, name, email, phone, address, district, created_at
       FROM customers ORDER BY created_at DESC`
    );
    res.json({ customers: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Newsletter routes
// Newsletter routes
const db = require('./db/index');

app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const existing = await db.query(
      'SELECT id FROM newsletter WHERE email = $1', [email]
    );

    if (existing.rows.length > 0) {
      await db.query(
        'UPDATE newsletter SET subscribed = true WHERE email = $1', [email]
      );
      return res.json({ success: true, message: 'You are already subscribed!' });
    }

    await db.query(
      'INSERT INTO newsletter (email, name) VALUES ($1, $2)',
      [email, name || null]
    );

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to B-Com newsletter!'
    });
  } catch (err) {
    console.error('Newsletter error:', err.message);
    res.status(500).json({ error: 'Subscription failed' });
  }
});

app.get('/api/newsletter/subscribers', adminAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM newsletter ORDER BY created_at DESC'
    );
    res.json({ subscribers: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/newsletter/unsubscribe/:id', adminAuth, async (req, res) => {
  try {
    await db.query(
      'UPDATE newsletter SET subscribed = false WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/newsletter/subscribers', adminAuth, async (req, res) => {
  try {
    const db = require('./db/index');
    const result = await db.query(
      'SELECT * FROM newsletter ORDER BY created_at DESC'
    );
    res.json({ subscribers: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/newsletter/unsubscribe/:id', adminAuth, async (req, res) => {
  try {
    const db = require('./db/index');
    await db.query(
      'UPDATE newsletter SET subscribed = false WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// ERROR HANDLING
// ============================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler — never expose error details in production
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);

  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Something went wrong. Please try again.'
  });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════╗
║     B-COM BELIZE API SERVER        ║
║     Port: ${PORT}                     ║
║     Environment: ${process.env.NODE_ENV || 'development'}          ║
║     Security: ENABLED              ║
╚════════════════════════════════════╝
  `);
});
