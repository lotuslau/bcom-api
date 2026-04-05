// ============================================================
// B-COM BELIZE — Reviews Route
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db/index');

// ── GET /api/reviews/:productId — Get approved reviews for a product
router.get('/:productId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM reviews 
       WHERE product_id = $1 AND approved = true
       ORDER BY created_at DESC`,
      [req.params.productId]
    );

    // Get rating summary
    const summary = await db.query(
      `SELECT 
        COUNT(*) as total,
        ROUND(AVG(rating), 1) as average,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
       FROM reviews 
       WHERE product_id = $1 AND approved = true`,
      [req.params.productId]
    );

    res.json({
      reviews: result.rows,
      summary: summary.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reviews — Submit a new review
router.post('/', async (req, res) => {
  try {
    const {
      product_id,
      customer_name,
      customer_email,
      rating,
      review_text,
      images,
      video_url
    } = req.body;

    if (!product_id || !customer_name || !rating) {
      return res.status(400).json({
        error: 'Product ID, name and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Rating must be between 1 and 5'
      });
    }

    const result = await db.query(
      `INSERT INTO reviews
        (product_id, customer_name, customer_email, 
         rating, review_text, images, video_url, approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)
       RETURNING *`,
      [
        product_id,
        customer_name,
        customer_email || null,
        rating,
        review_text || null,
        images || [],
        video_url || null
      ]
    );

    // Update product rating in products table
    await db.query(
      `UPDATE products SET
        rating = (
          SELECT ROUND(AVG(rating)::numeric, 2)
          FROM reviews
          WHERE product_id = $1 AND approved = true
        ),
        reviews_count = (
          SELECT COUNT(*)
          FROM reviews
          WHERE product_id = $1 AND approved = true
        )
       WHERE id = $1`,
      [product_id]
    );

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully! It will appear after approval.',
      review: result.rows[0]
    });

  } catch (err) {
    console.error('Review submission error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/reviews/:id/approve — Approve a review (admin)
router.put('/:id/approve', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE reviews SET approved = true WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Update product rating
    await db.query(
      `UPDATE products SET
        rating = (
          SELECT ROUND(AVG(rating)::numeric, 2)
          FROM reviews WHERE product_id = $1 AND approved = true
        ),
        reviews_count = (
          SELECT COUNT(*) FROM reviews 
          WHERE product_id = $1 AND approved = true
        )
       WHERE id = $1`,
      [result.rows[0].product_id]
    );

    res.json({ success: true, review: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/reviews/:id/helpful — Mark review as helpful
router.put('/:id/helpful', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE reviews 
       SET helpful_count = helpful_count + 1 
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json({ success: true, helpful_count: result.rows[0].helpful_count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/reviews/:id — Delete a review (admin)
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;