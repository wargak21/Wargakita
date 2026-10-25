require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const hash = await bcrypt.hash('password', 10);

    await pool.query(
      `INSERT INTO public.users
        (name, email, password_hash, role, rt_number, rw_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
         name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         rt_number = EXCLUDED.rt_number,
         rw_number = EXCLUDED.rw_number`,
      ['Staff RW Demo', 'staffrw@example.test', hash, 'staff_rw', null, '05']
    );

    console.log('Akun Staff RW berhasil disiapkan.');
    console.log('Email: staffrw@example.test');
    console.log('Password: password');
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Gagal membuat akun:', error.message);
  process.exitCode = 1;
});
