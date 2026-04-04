// ============================================================
// B-COM BELIZE — Auth Route (Login & Register)
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db/index');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bcom-secret-key';

// ── POST /api/auth/register — Register new customer
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, address, district } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Name, email and password are required'
      });
    }

    // Check if email already exists
    const existing = await db.query(
      'SELECT id FROM customers WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'An account with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create customer
    const result = await db.query(
      `INSERT INTO customers 
        (name, email, phone, address, district, password)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone, district`,
      [name, email, phone, address, district || 'Belize', hashedPassword]
    );

    const customer = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { id: customer.id, email: customer.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      customer
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login — Login customer
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Find customer
    const result = await db.query(
      'SELECT * FROM customers WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const customer = result.rows[0];

    // Check password
    if (!customer.password) {
      return res.status(401).json({
        error: 'Please register to create a password'
      });
    }

    const validPassword = await bcrypt.compare(password, customer.password);

    if (!validPassword) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: customer.id, email: customer.email },
      JWT_SECRET,
      { expiresIn: '7d' }
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
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/auth/me — Get current customer profile
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
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ customer: result.rows[0] });

  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;