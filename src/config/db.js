require('dotenv').config();
const { Pool, types } = require('pg');

types.setTypeParser(1082, (v) => v);                 // DATE  -> 'YYYY-MM-DD'
types.setTypeParser(20, (v) => parseInt(v, 10));      // BIGINT/COUNT -> number
types.setTypeParser(1700, (v) => parseFloat(v));      // NUMERIC -> number

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: Number(process.env.DB_POOL_MAX || 3), // kecil untuk serverless
});

const query = (text, params) => pool.query(text, params);
module.exports = { pool, query };
