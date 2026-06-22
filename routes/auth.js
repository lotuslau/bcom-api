// ============================================================
// B-COM BELIZE — Auth Route (Secured)
// ============================================================
/* global process */
const express = require('express');
const router = express.Router();
const db = require('../db/index');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '7d';

// Failed login tracking (in-memory for development)
const loginAttempts = new Map();

const checkLoginAttempts = (email) => {
  const attempts = loginAttempts.get(email) || { count: 0, lastAttempt: null };
  const now = Date.now();

  // Reset after 15 minutes
  if (attempts.lastAttempt && now - attempts.lastAttempt > 15 * 60 * 1000) {
    loginAttempts.delete(email);
    return false;
  }

  // Block after 5 failed attempts
  return attempts.count >= 5;
};

const recordFailedLogin = (email) => {
  const attempts = loginAttempts.get(email) || { count: 0, lastAttempt: null };
  loginAttempts.set(email, {
    count: attempts.count + 1,
    lastAttempt: Date.now()
  });
};

const clearLoginAttempts = (email) => {
  loginAttempts.delete(email);
};

// ── POST /api/auth/register
router.post('/register', [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters')
    .escape(),
  body('email')
    .trim()
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('phone')
    .optional()
    .trim()
    .escape(),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Address too long')
    .escape(),
], async (req, res) => {
  try {
      console.log('Register body:', req.body);
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg
      });
    }

    const { name, email, phone, password, address, district } = req.body;

    // Check if email exists
    const existing = await db.query(
      'SELECT id FROM customers WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'An account with this email already exists'
      });
    }

    // Hash password with high salt rounds
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO customers
        (name, email, phone, address, district, password)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, district`,
      [name, email, phone || null, address || null,
       district || 'Belize City', hashedPassword]
    );

    const customer = result.rows[0];
    
    console.log('Customer created:', customer);
    console.log('JWT_SECRET exists:', !!JWT_SECRET);

    const token = jwt.sign(
      { id: customer.id, email: customer.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      customer
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login
router.post('/login', [
  body('email')
    .trim()
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg
      });
    }

    const { email, password } = req.body;

    // Check if account is locked
    if (checkLoginAttempts(email)) {
      return res.status(429).json({
        error: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.'
      });
    }

    const result = await db.query(
      'SELECT * FROM customers WHERE email = $1',
      [email]
    );

    // Use same error message for wrong email or password
    // This prevents user enumeration attacks
    if (result.rows.length === 0) {
      recordFailedLogin(email);
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const customer = result.rows[0];

    if (!customer.password) {
      return res.status(401).json({
        error: 'Please register to create a password'
      });
    }

    const validPassword = await bcrypt.compare(password, customer.password);

    if (!validPassword) {
      recordFailedLogin(email);
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Clear failed attempts on success
    clearLoginAttempts(email);

    const token = jwt.sign(
      { id: customer.id, email: customer.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        district: customer.district
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const result = await db.query(
      `SELECT id, name, email, phone, address, district, created_at
       FROM customers WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ customer: result.rows[0] });

  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Invalid or expired token' });
    } else {
      console.error('Get me error:', err);
      res.status(500).json({ error: 'Failed to fetch customer data' });
    }
  }
});

module.exports = router;