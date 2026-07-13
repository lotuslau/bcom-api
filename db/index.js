const { Pool } = require('pg');
require('dotenv').config();

const useDatabaseUrl = Boolean(process.env.DATABASE_URL);
const sslEnabled = process.env.DB_SSL === 'true' || Boolean(process.env.DATABASE_URL) || /supabase|neon|render/i.test(process.env.DB_HOST || '');
const sslConfig = sslEnabled ? { rejectUnauthorized: false } : false;

const pool = new Pool(
  useDatabaseUrl
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: sslConfig,
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : false,
      });

pool.connect((err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('✅ Connected to b_com_db successfully!');
  }
});

module.exports = pool;
