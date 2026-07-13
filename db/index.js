const { Pool } = require('pg');
require('dotenv').config();

const useDatabaseUrl = Boolean(process.env.DATABASE_URL);
const sslEnabled = process.env.DB_SSL === 'true' || /supabase|neon|render/.test(process.env.DB_HOST || '');

const pool = new Pool(
  useDatabaseUrl
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: sslEnabled ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: sslEnabled ? { rejectUnauthorized: false } : false,
      }
);

pool.connect((err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('✅ Connected to b_com_db successfully!');
  }
});

module.exports = pool;
