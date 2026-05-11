// ============================================================
// B-COM BELIZE — Payments Route
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db/index');

const VALID_PAYMENT_METHODS = [
  'belize_bank_card',
  'atlantic_bank_card'
];

// ── POST /api/payments/initiate
router.post('/initiate', async (req, res) => {
  try {
    const { order_id, payment_method, amount } = req.body;

    if (!order_id || !payment_method || !amount) {
      return res.status(400).json({
        error: 'Order ID, payment method and amount are required'
      });
    }

    if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({
        error: 'Invalid payment method'
      });
    }

    const ref = `BCM-${order_id}-${Date.now().toString().slice(-5)}`;

    await db.query(
      `INSERT INTO payments
        (order_id, gateway, transaction_ref, amount_bzd, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [order_id, payment_method, ref, amount]
    );

    // ── BELIZE BANK HOSTED PAYMENT PAGE
    if (payment_method === 'belize_bank_card') {

      if (!process.env.BELIZE_BANK_MERCHANT_ID) {
        return res.json({
          success: true,
          method: 'belize_bank_card',
          reference: ref,
          status: 'pending_merchant_setup',
          message: 'Belize Bank gateway is being configured.',
          instructions: 'Our team will contact you to complete payment.',
          contact: 'hello@b-com.bz'
        });
      }

      // When merchant account is ready:
      // 1. Call BBL authorize endpoint
      // 2. Get redirect URL
      // 3. Return redirect URL to frontend
      return res.json({
        success: true,
        method: 'belize_bank_card',
        reference: ref,
        redirectUrl: process.env.BELIZE_BANK_GATEWAY_URL,
        merchantId: process.env.BELIZE_BANK_MERCHANT_ID,
        amount: amount,
        currency: 'BZD',
        callbackUrl: `${process.env.API_URL}/api/payments/callback/belize-bank`
      });
    }

    // ── ATLANTIC BANK HOSTED PAYMENT PAGE
    if (payment_method === 'atlantic_bank_card') {

      if (!process.env.ATLANTIC_BANK_MERCHANT_ID) {
        return res.json({
          success: true,
          method: 'atlantic_bank_card',
          reference: ref,
          status: 'pending_merchant_setup',
          message: 'Atlantic Bank gateway is being configured.',
          instructions: 'Our team will contact you to complete payment.',
          contact: 'hello@b-com.bz'
        });
      }

      return res.json({
        success: true,
        method: 'atlantic_bank_card',
        reference: ref,
        redirectUrl: process.env.ATLANTIC_BANK_GATEWAY_URL,
        merchantId: process.env.ATLANTIC_BANK_MERCHANT_ID,
        amount: amount,
        currency: 'BZD',
        callbackUrl: `${process.env.API_URL}/api/payments/callback/atlantic-bank`
      });
    }

  } catch (err) {
    console.error('Payment error:', err.message);
    res.status(500).json({ error: 'Payment initiation failed' });
  }
});

// ── POST /api/payments/callback/belize-bank
// This is called by Belize Bank after payment processing
router.post('/callback/belize-bank', async (req, res) => {
  try {
    const {
      orderRef,
      status,
      transactionId,
      amount,
      responseCode
    } = req.body;

    console.log('Belize Bank callback received:', req.body);

    const paymentStatus = responseCode === '00' ? 'success' : 'failed';

    await db.query(
      `UPDATE payments
       SET status = $1,
           gateway_response = $2
       WHERE transaction_ref = $3`,
      [
        paymentStatus,
        JSON.stringify(req.body),
        orderRef
      ]
    );

    if (paymentStatus === 'success') {
      await db.query(
        `UPDATE orders SET status = 'paid'
         WHERE payment_ref = $1`,
        [orderRef]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('BBL callback error:', err.message);
    res.status(500).json({ error: 'Callback processing failed' });
  }
});

// ── POST /api/payments/callback/atlantic-bank
router.post('/callback/atlantic-bank', async (req, res) => {
  try {
    const { orderRef, responseCode } = req.body;

    console.log('Atlantic Bank callback received:', req.body);

    const paymentStatus = responseCode === '00' ? 'success' : 'failed';

    await db.query(
      `UPDATE payments
       SET status = $1,
           gateway_response = $2
       WHERE transaction_ref = $3`,
      [paymentStatus, JSON.stringify(req.body), orderRef]
    );

    if (paymentStatus === 'success') {
      await db.query(
        `UPDATE orders SET status = 'paid'
         WHERE payment_ref = $1`,
        [orderRef]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Atlantic callback error:', err.message);
    res.status(500).json({ error: 'Callback processing failed' });
  }
});

// ── GET /api/payments/:orderId
router.get('/:orderId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC',
      [req.params.orderId]
    );
    res.json({ payments: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/payments/confirm
router.post('/confirm', async (req, res) => {
  try {
    const { reference, status, gateway_response } = req.body;

    const payment = await db.query(
      'SELECT * FROM payments WHERE transaction_ref = $1',
      [reference]
    );

    if (payment.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    await db.query(
      `UPDATE payments
       SET status = $1, gateway_response = $2
       WHERE transaction_ref = $3`,
      [status, JSON.stringify(gateway_response), reference]
    );

    if (status === 'success') {
      await db.query(
        `UPDATE orders SET status = 'paid' WHERE id = $1`,
        [payment.rows[0].order_id]
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;