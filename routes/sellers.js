// ============================================================
// B-COM BELIZE — Sellers Route
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db/index');

// ── POST /api/sellers/register — Register new seller
router.post('/register', async (req, res) => {
  try {
    const {
      store_name,
      owner_name,
      email,
      phone,
      address,
      belize_tax_id,
      bank_name,
      account_no,
      categories
    } = req.body;

    if (!store_name || !owner_name || !email) {
      return res.status(400).json({
        error: 'Store name, owner name and email are required'
      });
    }

    // Check if email already exists
    const existing = await db.query(
      'SELECT id FROM sellers WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'A seller account with this email already exists'
      });
    }

    const result = await db.query(
      `INSERT INTO sellers
        (store_name, owner_name, email, phone, address,
         belize_tax_id, bank_name, account_no, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [
        store_name,
        owner_name,
        email,
        phone,
        address,
        belize_tax_id,
        bank_name,
        account_no
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Seller application submitted successfully. We will review within 48 hours.',
      seller: result.rows[0]
    });

  } catch (err) {
    console.error('Seller registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sellers — Get all approved sellers
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, store_name, owner_name, commission_pct, created_at
       FROM sellers
       WHERE status = 'approved'
       ORDER BY created_at DESC`
    );
    res.json({ sellers: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sellers/:id — Get seller by id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, store_name, owner_name, created_at
       FROM sellers WHERE id = $1 AND status = 'approved'`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // Get seller products
    const products = await db.query(
      `SELECT * FROM products 
       WHERE seller_id = $1 AND is_active = true`,
      [req.params.id]
    );

    res.json({
      seller: result.rows[0],
      products: products.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/sellers/:id/status — Approve or suspend seller (admin)
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'approved', 'suspended'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
      `UPDATE sellers SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    res.json({ success: true, seller: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;