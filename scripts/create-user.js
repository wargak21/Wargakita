// Contoh (PowerShell):
//   $env:SEED_NAME="Ketua RW"; $env:SEED_USERNAME="rw05"; $env:SEED_PASSWORD="GantiPassword123!"
//   $env:SEED_ROLE="rw"; $env:SEED_RW="05"; node scripts/create-user.js
// Role rt  : tambah SEED_RT="03"
// Role warga: tambah SEED_RT, SEED_RW (opsional) dan SEED_FAMILY_ID
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

(async () => {
  const e = process.env;
  const role = e.SEED_ROLE || 'rw';
  if (!e.SEED_NAME || !e.SEED_USERNAME || !e.SEED_PASSWORD) throw new Error('SEED_NAME, SEED_USERNAME, SEED_PASSWORD wajib diisi');
  if (e.SEED_PASSWORD.length < 8) throw new Error('Password minimal 8 karakter');
  if (!['rw', 'rt', 'warga'].includes(role)) throw new Error('SEED_ROLE harus rw / rt / warga');
  const hash = await bcrypt.hash(e.SEED_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (name, username, email, password_hash, role, rt, rw, family_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [e.SEED_NAME, e.SEED_USERNAME, e.SEED_EMAIL || null, hash, role, e.SEED_RT || null, e.SEED_RW || null, e.SEED_FAMILY_ID || null]
  );
  console.log(`Akun "${e.SEED_USERNAME}" (${role}) berhasil dibuat.`);
  await pool.end();
})().catch((err) => { console.error('Gagal:', err.message); process.exit(1); });
