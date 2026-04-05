// ============================================================
// B-COM BELIZE — Orders Route
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db/index');

// ── POST /api/orders — Create a new order
router.post('/', async (req, res) => {
  try {
    const {
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      district,
      notes,
      payment_method,
      external_link,
      items,
      terms_agreed,
      terms_agreed_at,
    } = req.body;

    // Validate required fields
    if (!customer_name || !customer_email || !customer_phone || !shipping_address) {
      return res.status(400).json({
        error: 'Please provide name, email, phone and shipping address'
      });
    }

    // Calculate totals
    let subtotal = 0;
    if (items && items.length > 0) {
      subtotal = items.reduce((sum, item) => {
        return sum + (parseFloat(item.unit_price) * item.qty);
      }, 0);
    }

    const tax = subtotal * 0.125;
    const shipping = subtotal > 200 ? 0 : 15;
    const total = subtotal + tax + shipping;

    // Generate order reference
    const orderRef = 'BCM-' + String(Date.now()).slice(-5);

    // Save or find customer
    let customer;
    const existingCustomer = await db.query(
      'SELECT * FROM customers WHERE email = $1',
      [customer_email]
    );

    if (existingCustomer.rows.length > 0) {
      customer = existingCustomer.rows[0];
    } else {
      const newCustomer = await db.query(
        `INSERT INTO customers (name, email, phone, address, district)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [customer_name, customer_email, customer_phone, shipping_address, district]
      );
      customer = newCustomer.rows[0];
    }

    // Create the order
    const orderResult = await db.query(
      `INSERT INTO orders 
        (customer_id, status, subtotal_bzd, shipping_bzd, tax_bzd, 
         total_bzd, payment_method, payment_ref, shipping_address, district, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        customer.id,
        'pending',
        subtotal.toFixed(2),
        shipping.toFixed(2),
        tax.toFixed(2),
        total.toFixed(2),
        payment_method,
        orderRef,
        shipping_address,
        district || 'Belize',
        `${notes || ''} ${external_link ? '| External: ' + external_link : ''} | Terms agreed: ${terms_agreed} at ${terms_agreed_at}`
      ]
    );

    const order = orderResult.rows[0];

    // Save order items if any
    if (items && items.length > 0) {
      for (const item of items) {
        await db.query(
          `INSERT INTO order_items 
            (order_id, product_id, qty, unit_price, size, color)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            order.id,
            item.product_id,
            item.qty,
            item.unit_price,
            item.size || 'One Size',
            item.color || 'Default'
          ]
        );
      }
    }

    // Create payment record
    await db.query(
      `INSERT INTO payments 
        (order_id, gateway, transaction_ref, amount_bzd, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        order.id,
        payment_method,
        orderRef,
        total.toFixed(2),
        'pending'
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        id: order.id,
        reference: orderRef,
        total: total.toFixed(2),
        status: 'pending',
        payment_method
      }
    });

  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/orders — Get all orders (admin)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*, c.name as customer_name, c.email, c.phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       ORDER BY o.created_at DESC`
    );
    res.json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/orders/:ref — Get order by reference
router.get('/:ref', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*, c.name as customer_name, c.email, c.phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.payment_ref = $1`,
      [req.params.ref]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get order items
    const items = await db.query(
      `SELECT oi.*, p.name as product_name, p.images
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [result.rows[0].id]
    );

    res.json({
      order: result.rows[0],
      items: items.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/orders/:id/status — Update order status (admin)
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      'pending', 'paid', 'processing', 
      'shipped', 'delivered', 'cancelled', 'refunded'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;