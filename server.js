// ============================================================
// B-COM BELIZE — Secure Server
// ============================================================
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
  'https://b-com.bz',
  'https://www.b-com.bz',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // only 10 login attempts per 15 min
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
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
app.use('/api/sellers', require('./routes/sellers'));

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