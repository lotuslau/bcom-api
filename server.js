const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Allow your React app (port 5173) to connect
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Test route — visit http://localhost:3001/api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'B-Com API is running!' });
});

// Import route files
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sellers', require('./routes/sellers'));
app.use('/api/payments', require('./routes/payments'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});