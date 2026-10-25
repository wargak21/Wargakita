require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Skema database berhasil diterapkan.');
  await pool.end();
})().catch((e) => { console.error('Gagal:', e.message); process.exit(1); });
