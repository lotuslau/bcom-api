// ============================================================
// B-COM BELIZE — Auth Middleware
// ============================================================
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        error: 'Not authorized. Please sign in.'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.customer = decoded;
    next();

  } catch (err) {
    return res.status(401).json({
      error: 'Invalid or expired token. Please sign in again.'
    });
  }
};

const adminProtect = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
    return res.status(401).json({ error: 'Admin access denied' });
  }
  next();
};

module.exports = { protect, adminProtect };