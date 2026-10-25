require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const accounts = [
    { name: 'RW Demo', email: 'rw@example.test', role: 'rw', rt: null },
    { name: 'RT Demo', email: 'rt01@example.test', role: 'rt', rt: '01' },
    { name: 'Staff RW Demo', email: 'staffrw@example.test', role: 'staff_rw', rt: null },
    { name: 'Warga Demo', email: 'warga@example.test', role: 'warga', rt: null }
  ];

  try {
    const hash = await bcrypt.hash('password', 10);

    for (const a of accounts) {
      const existing = await pool.query(
        'SELECT id FROM public.users WHERE email = $1',
        [a.email]
      );

      if (existing.rowCount) {
        await pool.query(
          `UPDATE public.users
           SET name=$1, password_hash=$2, role=$3,
               rt_number=$4, rw_number='05'
           WHERE email=$5`,
          [a.name, hash, a.role, a.rt, a.email]
        );
      } else {
        const family = a.role === 'warga'
          ? await pool.query(
              `SELECT id FROM public.families
               WHERE rt_number='01' AND rw_number='05'
               ORDER BY id LIMIT 1`
            )
          : { rows: [] };

        await pool.query(
          `INSERT INTO public.users
           (name,email,password_hash,role,rt_number,rw_number,family_id)
           VALUES ($1,$2,$3,$4,$5,'05',$6)`,
          [a.name, a.email, hash, a.role, a.rt, family.rows[0]?.id ?? null]
        );
      }

      console.log('OK:', a.email);
    }

    console.log('\nSelesai. Password semua akun: password');
  } finally {
    await pool.end();
  }
}

main().catch(e => {
  console.error('GAGAL:', e.message);
  process.exitCode = 1;
});
