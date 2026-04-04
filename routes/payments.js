// ============================================================
// B-COM BELIZE — Payments Route
// ============================================================
const express = require('express');
const router = express.Router();
const db = require('../db/index');

// ── POST /api/payments/initiate — Initiate a payment
router.post('/initiate', async (req, res) => {
  try {
    const { order_id, payment_method, amount } = req.body;

    if (!order_id || !payment_method || !amount) {
      return res.status(400).json({
        error: 'Order ID, payment method and amount are required'
      });
    }

    const ref = `BCM-${order_id}-${Date.now().toString().slice(-5)}`;

    // Save payment record
    await db.query(
      `INSERT INTO payments
        (order_id, gateway, transaction_ref, amount_bzd, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [order_id, payment_method, ref, amount]
    );

    // Handle different payment methods
    switch (payment_method) {

      case 'belize_bank_card':
        // Belize Bank hosted payment page
        // In production: redirect to Belize Bank gateway URL
        res.json({
          success: true,
          method: 'belize_bank_card',
          reference: ref,
          message: 'Redirecting to Belize Bank secure payment page...',
          // redirectUrl: process.env.BELIZE_BANK_GATEWAY_URL,
          // In production uncomment and add your Belize Bank gateway URL
          instructions: 'Contact Belize Bank to activate your Internet Merchant Account'
        });
        break;

      case 'atlantic_bank_card':
        // Atlantic Bank hosted payment page
        res.json({
          success: true,
          method: 'atlantic_bank_card',
          reference: ref,
          message: 'Redirecting to Atlantic Bank secure payment page...',
          instructions: 'Contact Atlantic Bank to activate your payment gateway'
        });
        break;

      case 'belize_bank_transfer':
        res.json({
          success: true,
          method: 'belize_bank_transfer',
          reference: ref,
          accountName: 'B-Com Belize Ltd',
          accountNumber: process.env.BCOM_BBL_ACCOUNT || 'XXX-XXXXX-X',
          bank: 'Belize Bank Limited',
          amount: amount,
          currency: 'BZD',
          instructions: [
            'Log into your Belize Bank online banking',
            'Transfer BZ$ ' + amount + ' to the account above',
            'Use reference: ' + ref,
            'Send confirmation to hello@b-com.bz'
          ]
        });
        break;

      case 'atlantic_bank_transfer':
        res.json({
          success: true,
          method: 'atlantic_bank_transfer',
          reference: ref,
          accountName: 'B-Com Belize Ltd',
          accountNumber: process.env.BCOM_ATL_ACCOUNT || 'XXX-XXXXX-X',
          bank: 'Atlantic Bank Limited',
          amount: amount,
          currency: 'BZD',
          instructions: [
            'Log into your Atlantic Bank online banking',
            'Transfer BZ$ ' + amount + ' to the account above',
            'Use reference: ' + ref,
            'Send confirmation to hello@b-com.bz'
          ]
        });
        break;

      case 'paypal':
        res.json({
          success: true,
          method: 'paypal',
          reference: ref,
          message: 'Redirecting to PayPal...',
          // In production: create PayPal order and return approval URL
          instructions: 'PayPal integration coming soon. Contact us to complete payment.'
        });
        break;

      case 'cash_delivery':
        // Update order status
        await db.query(
          `UPDATE orders SET status = 'processing' WHERE id = $1`,
          [order_id]
        );
        await db.query(
          `UPDATE payments SET status = 'pending' 
           WHERE order_id = $1 AND gateway = 'cash_delivery'`,
          [order_id]
        );
        res.json({
          success: true,
          method: 'cash_delivery',
          reference: ref,
          message: 'Order confirmed! Pay when your order arrives.',
          instructions: 'Please have exact change ready for delivery.'
        });
        break;

      default:
        res.status(400).json({ error: 'Invalid payment method' });
    }

  } catch (err) {
    console.error('Payment initiation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/payments/confirm — Confirm a payment (webhook)
router.post('/confirm', async (req, res) => {
  try {
    const { reference, status, gateway_response } = req.body;

    // Find payment by reference
    const payment = await db.query(
      'SELECT * FROM payments WHERE transaction_ref = $1',
      [reference]
    );

    if (payment.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Update payment status
    await db.query(
      `UPDATE payments 
       SET status = $1, gateway_response = $2
       WHERE transaction_ref = $3`,
      [status, JSON.stringify(gateway_response), reference]
    );

    // If payment successful update order status
    if (status === 'success') {
      await db.query(
        `UPDATE orders SET status = 'paid' 
         WHERE id = $1`,
        [payment.rows[0].order_id]
      );
    }

    res.json({ success: true, message: 'Payment status updated' });

  } catch (err) {
    console.error('Payment confirmation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/payments/:orderId — Get payments for an order
router.get('/:orderId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC',
      [req.params.orderId]
    );
    res.json({ payments: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;