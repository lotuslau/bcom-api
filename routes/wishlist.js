// ============================================================
// B-COM BELIZE — Wishlist Route
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db/index');
const jwt = require('jsonwebtoken');

const getCustomerId = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id;
  } catch (err) {
    return null;
  }
};

// ── GET /api/wishlist — Get customer's wishlist
router.get('/', async (req, res) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) return res.json({ productIds: [] });

    const result = await db.query(
      'SELECT product_id FROM wishlist_items WHERE customer_id = $1',
      [customerId]
    );

    res.json({ productIds: result.rows.map(r => r.product_id) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/wishlist/toggle — Add or remove from wishlist
router.post('/toggle', async (req, res) => {
  try {
    const customerId = getCustomerId(req);
    if (!customerId) {
      return res.status(401).json({ error: 'Please sign in to save items' });
    }

    const { product_id } = req.body;

    const existing = await db.query(
      'SELECT id FROM wishlist_items WHERE customer_id = $1 AND product_id = $2',
      [customerId, product_id]
    );

    if (existing.rows.length > 0) {
      await db.query(
        'DELETE FROM wishlist_items WHERE customer_id = $1 AND product_id = $2',
        [customerId, product_id]
      );
      return res.json({ success: true, action: 'removed' });
    } else {
      await db.query(
        'INSERT INTO wishlist_items (customer_id, product_id) VALUES ($1, $2)',
        [customerId, product_id]
      );
      return res.json({ success: true, action: 'added' });
    }

  } catch (err) {
    console.error('Wishlist error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;