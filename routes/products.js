const express = require('express');
const router = express.Router();
const db = require('../db/index');

// GET all products: http://localhost:3001/api/products
router.get('/', async (req, res) => {
  try {
    const { category, store, search } = req.query;
    let query = 'SELECT * FROM products WHERE is_active = true';
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category_id = $${params.length}`;
    }

    const result = await db.query(query, params);
    res.json({ products: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single product by id
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM products WHERE id = $1', [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;