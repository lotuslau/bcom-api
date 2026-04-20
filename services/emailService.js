// ============================================================
// B-COM BELIZE — Email Service
// ============================================================
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Verify connection
transporter.verify((error) => {
  if (error) {
    console.log('❌ Email service error:', error.message);
  } else {
    console.log('✅ Email service ready');
  }
});

// ── Order Confirmation Email
const sendOrderConfirmation = async (order, customer) => {
  const {
    payment_ref,
    total_bzd,
    subtotal_bzd,
    shipping_bzd,
    tax_bzd,
    payment_method,
    shipping_address,
    district,
    status
  } = order;

  const paymentLabel = payment_method?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation — BCom Belize</title>
    </head>
    <body style="margin:0;padding:0;background:#f9f9f9;font-family:'Segoe UI',Arial,sans-serif;">
      
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        
        <!-- HEADER -->
        <div style="background:#2563EB;border-radius:16px 16px 0 0;padding:32px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:28px;font-weight:900;letter-spacing:2px;">
            B-COM BELIZE
          </h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">
            Your Order is Confirmed! 🎉
          </p>
        </div>

        <!-- BODY -->
        <div style="background:white;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          
          <p style="font-size:16px;color:#374151;margin:0 0 24px;">
            Hi <strong>${customer.name}</strong>,
          </p>
          <p style="font-size:15px;color:#6b7280;line-height:1.7;margin:0 0 24px;">
            Thank you for shopping with B-Com Belize! Your order has been received 
            and is being processed. Here are your order details:
          </p>

          <!-- ORDER REFERENCE -->
          <div style="background:#f0f7ff;border:2px solid #2563EB;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
            <p style="color:#6b7280;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">
              Order Reference
            </p>
            <p style="color:#2563EB;font-size:24px;font-weight:900;margin:0;font-family:monospace;">
              ${payment_ref}
            </p>
            <p style="color:#6b7280;font-size:12px;margin:8px 0 0;">
              Save this reference to track your order via WhatsApp
            </p>
          </div>

          <!-- ORDER DETAILS -->
          <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
            <tr style="background:#f9fafb;">
              <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;">
                Detail
              </td>
              <td style="padding:12px 16px;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;text-align:right;">
                Value
              </td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">
                Subtotal
              </td>
              <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;text-align:right;">
                BZ$ ${parseFloat(subtotal_bzd || 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">
                Shipping
              </td>
              <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;text-align:right;">
                ${parseFloat(shipping_bzd || 0) === 0 ? 'FREE' : `BZ$ ${parseFloat(shipping_bzd || 0).toFixed(2)}`}
              </td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;">
                GST (12.5%)
              </td>
              <td style="padding:12px 16px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;text-align:right;">
                BZ$ ${parseFloat(tax_bzd || 0).toFixed(2)}
              </td>
            </tr>
            <tr style="background:#f0f7ff;">
              <td style="padding:14px 16px;font-size:16px;color:#2563EB;font-weight:800;">
                Total
              </td>
              <td style="padding:14px 16px;font-size:16px;color:#2563EB;font-weight:800;text-align:right;">
                BZ$ ${parseFloat(total_bzd || 0).toFixed(2)}
              </td>
            </tr>
          </table>

          <!-- DELIVERY INFO -->
          <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:0 0 24px;">
            <h3 style="margin:0 0 12px;font-size:14px;color:#374151;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
              📦 Delivery Information
            </h3>
            <p style="margin:0 0 6px;font-size:14px;color:#6b7280;">
              <strong>Name:</strong> ${customer.name}
            </p>
            <p style="margin:0 0 6px;font-size:14px;color:#6b7280;">
              <strong>Address:</strong> ${shipping_address || 'Not provided'}
            </p>
            <p style="margin:0 0 6px;font-size:14px;color:#6b7280;">
              <strong>Area:</strong> ${district || 'Belize City'}
            </p>
            <p style="margin:0;font-size:14px;color:#6b7280;">
              <strong>Phone:</strong> ${customer.phone || 'Not provided'}
            </p>
          </div>

          <!-- PAYMENT INFO -->
          <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:0 0 24px;">
            <h3 style="margin:0 0 12px;font-size:14px;color:#374151;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
              💳 Payment Information
            </h3>
            <p style="margin:0 0 6px;font-size:14px;color:#6b7280;">
              <strong>Method:</strong> ${paymentLabel}
            </p>
            <p style="margin:0;font-size:14px;color:#6b7280;">
              <strong>Status:</strong> 
              <span style="color:#f59e0b;font-weight:600;">
                ${status?.charAt(0).toUpperCase() + status?.slice(1) || 'Pending'}
              </span>
            </p>
          </div>

          <!-- DELIVERY TIMEFRAME -->
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:16px;margin:0 0 24px;">
            <p style="margin:0;font-size:14px;color:#166534;line-height:1.6;">
              🚚 <strong>Estimated Delivery:</strong> 
              1-2 business days for Belize City. 
              2-3 business days for Ladyville and Sandhill.
            </p>
          </div>

          <!-- TRACK ORDER -->
          <div style="text-align:center;margin:0 0 24px;">
            <p style="font-size:14px;color:#6b7280;margin:0 0 12px;">
              Track your order by contacting us on WhatsApp with your reference number
            </p>
            <a href="https://wa.me/501XXXXXXXX?text=Hi!%20I%20want%20to%20track%20my%20order%20${payment_ref}" 
               style="display:inline-block;background:#25D366;color:white;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;">
              Track on WhatsApp →
            </a>
          </div>

          <!-- POLICIES -->
          <div style="border-top:1px solid #e5e7eb;padding-top:20px;">
            <p style="font-size:13px;color:#9ca3af;text-align:center;line-height:1.7;margin:0;">
              By placing this order you agreed to our 
              <a href="https://b-com.bz/terms" style="color:#2563EB;">Terms & Conditions</a>, 
              <a href="https://b-com.bz/refund-policy" style="color:#2563EB;">Return Policy</a> and 
              <a href="https://b-com.bz/delivery-policy" style="color:#2563EB;">Delivery Policy</a>.
              <br>
              Agreement recorded at: ${new Date().toLocaleString('en-BZ')}
            </p>
          </div>
        </div>

        <!-- FOOTER -->
        <div style="background:#1a1a2e;border-radius:0 0 16px 16px;padding:24px;text-align:center;">
          <p style="color:rgba(255,255,255,0.9);font-weight:700;font-size:16px;margin:0 0 8px;letter-spacing:1px;">
            B-COM BELIZE
          </p>
          <p style="color:rgba(255,255,255,0.5);font-size:12px;margin:0 0 12px;">
            Belize City, Belize · hello@b-com.bz · +501-XXX-XXXX
          </p>
          <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:0;">
            © 2025 B-Com Belize Ltd. All rights reserved.
            <br>
            🔒 PCI DSS Compliant · 🇧🇿 Proudly Belizean
          </p>
        </div>

      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: customer.email,
    subject: `✅ Order Confirmed — ${payment_ref} | B-Com Belize`,
    html,
    text: `
      B-Com Belize — Order Confirmation
      
      Hi ${customer.name},
      
      Your order ${payment_ref} has been confirmed!
      
      Total: BZ$ ${parseFloat(total_bzd || 0).toFixed(2)}
      Payment: ${paymentLabel}
      Delivery to: ${shipping_address}, ${district}
      
      Track your order via WhatsApp: +501-XXX-XXXX
      
      Thank you for shopping with B-Com Belize!
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Order confirmation email sent to ${customer.email}`);
    return true;
  } catch (err) {
    console.error('❌ Email send error:', err.message);
    return false;
  }
};

// ── Admin notification email
const sendAdminNotification = async (order, customer) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;">
      <h2 style="color:#2563EB;">🛒 New Order Received!</h2>
      <p><strong>Reference:</strong> ${order.payment_ref}</p>
      <p><strong>Customer:</strong> ${customer.name} (${customer.email})</p>
      <p><strong>Phone:</strong> ${customer.phone}</p>
      <p><strong>Total:</strong> BZ$ ${parseFloat(order.total_bzd || 0).toFixed(2)}</p>
      <p><strong>Payment:</strong> ${order.payment_method?.replace(/_/g, ' ')}</p>
      <p><strong>Delivery to:</strong> ${order.shipping_address}, ${order.district}</p>
      <p><strong>Notes:</strong> ${order.notes || 'None'}</p>
      <hr>
      <p style="color:#6b7280;font-size:12px;">
        Log in to your admin panel to update the order status.
      </p>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_USER,
    subject: `🛒 New Order: ${order.payment_ref} — BZ$ ${parseFloat(order.total_bzd || 0).toFixed(2)}`,
    html
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Admin notification sent');
    return true;
  } catch (err) {
    console.error('❌ Admin email error:', err.message);
    return false;
  }
};

module.exports = { sendOrderConfirmation, sendAdminNotification };