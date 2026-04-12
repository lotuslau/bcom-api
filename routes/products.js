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

// PUT /api/products/:id — Update product
router.put('/:id', async (req, res) => {
  try {
    const {
      name, description, price_bzd, stock_qty,
      brand, category_id, external_store,
      is_active, featured, sizes, colors
    } = req.body;

    const result = await db.query(
      `UPDATE products SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        price_bzd = COALESCE($3, price_bzd),
        stock_qty = COALESCE($4, stock_qty),
        brand = COALESCE($5, brand),
        category_id = COALESCE($6, category_id),
        external_store = COALESCE($7, external_store),
        is_active = COALESCE($8, is_active),
        featured = COALESCE($9, featured),
        sizes = COALESCE($10, sizes),
        colors = COALESCE($11, colors),
        updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [name, description, price_bzd, stock_qty,
       brand, category_id, external_store,
       is_active, featured, sizes, colors,
       req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id — Delete product
router.delete('/:id', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM products WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products — Add new product
router.post('/', async (req, res) => {
  try {
    const {
      name, description, price_bzd, stock_qty,
      brand, category_id, external_store,
      is_active, featured, sizes, colors, images
    } = req.body;

    const result = await db.query(
      `INSERT INTO products
        (name, description, price_bzd, stock_qty, brand,
         category_id, external_store, is_active, featured,
         sizes, colors, images)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [name, description, price_bzd, stock_qty || 0,
       brand, category_id || 1, external_store || 'own',
       is_active !== false, featured || false,
       sizes || '[]', colors || '[]', images || null]
    );

    res.status(201).json({ success: true, product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;