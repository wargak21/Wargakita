require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

async function main() {
  const client = await pool.connect();

  try {
    console.log('Memeriksa database WargaKita...');

    await client.query('BEGIN');

    // Tambahkan kolom kompatibilitas tanpa menghapus kolom lama.
    await client.query(`
      ALTER TABLE public.families
        ADD COLUMN IF NOT EXISTS no_kk VARCHAR(16),
        ADD COLUMN IF NOT EXISTS kepala_keluarga TEXT,
        ADD COLUMN IF NOT EXISTS alamat TEXT,
        ADD COLUMN IF NOT EXISTS rt VARCHAR(3),
        ADD COLUMN IF NOT EXISTS rw VARCHAR(3),
        ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Aktif';

      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS username TEXT,
        ADD COLUMN IF NOT EXISTS phone TEXT,
        ADD COLUMN IF NOT EXISTS rt VARCHAR(3),
        ADD COLUMN IF NOT EXISTS rw VARCHAR(3);

      ALTER TABLE public.residents
        ADD COLUMN IF NOT EXISTS nama TEXT,
        ADD COLUMN IF NOT EXISTS jenis_kelamin CHAR(1),
        ADD COLUMN IF NOT EXISTS tempat_lahir TEXT,
        ADD COLUMN IF NOT EXISTS tgl_lahir DATE,
        ADD COLUMN IF NOT EXISTS hubungan TEXT;

      ALTER TABLE public.letters
        ADD COLUMN IF NOT EXISTS nomor TEXT,
        ADD COLUMN IF NOT EXISTS jenis TEXT,
        ADD COLUMN IF NOT EXISTS family_id BIGINT,
        ADD COLUMN IF NOT EXISTS pemohon_nama TEXT,
        ADD COLUMN IF NOT EXISTS keperluan TEXT,
        ADD COLUMN IF NOT EXISTS catatan TEXT,
        ADD COLUMN IF NOT EXISTS created_by BIGINT,
        ADD COLUMN IF NOT EXISTS rt_by BIGINT,
        ADD COLUMN IF NOT EXISTS rt_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rw_by BIGINT,
        ADD COLUMN IF NOT EXISTS rw_at TIMESTAMPTZ;
    `);

    // Salin nilai kolom lama jika tersedia.
    await client.query(`
      UPDATE public.families
      SET
        no_kk = COALESCE(no_kk, family_card_number),
        kepala_keluarga = COALESCE(kepala_keluarga, head_name),
        alamat = COALESCE(alamat, address),
        rt = COALESCE(rt, rt_number),
        rw = COALESCE(rw, rw_number)
      WHERE no_kk IS NULL
         OR kepala_keluarga IS NULL
         OR alamat IS NULL
         OR rt IS NULL
         OR rw IS NULL;
    `);

    await client.query(`
      UPDATE public.users
      SET
        username = COALESCE(
          NULLIF(username, ''),
          split_part(email, '@', 1) || '_' || id::text
        ),
        rt = COALESCE(rt, rt_number),
        rw = COALESCE(rw, rw_number)
      WHERE username IS NULL OR rt IS NULL OR rw IS NULL;
    `);

    await client.query(`
      UPDATE public.residents
      SET
        nama = COALESCE(nama, name),
        jenis_kelamin = COALESCE(
          jenis_kelamin,
          CASE
            WHEN upper(gender) IN ('L', 'LAKI-LAKI', 'MALE') THEN 'L'
            WHEN upper(gender) IN ('P', 'PEREMPUAN', 'FEMALE') THEN 'P'
            ELSE NULL
          END
        ),
        tgl_lahir = COALESCE(tgl_lahir, birth_date)
      WHERE nama IS NULL
         OR jenis_kelamin IS NULL
         OR tgl_lahir IS NULL;
    `);

    // Jangan mengubah constraint tabel surat lama jika berisi data.
    const letterCount = await client.query(
      'SELECT COUNT(*)::int AS total FROM public.letters'
    );

    if (letterCount.rows[0].total === 0) {
      await client.query(`
        ALTER TABLE public.letters
          ALTER COLUMN resident_id DROP NOT NULL,
          ALTER COLUMN letter_type DROP NOT NULL,
          ALTER COLUMN purpose DROP NOT NULL;
      `);
    } else {
      console.log(
        'Tabel letters berisi data; constraint lama dipertahankan.'
      );
    }

    // Kolom lama yang wajib diisi tidak boleh menghalangi
    // penulisan melalui nama kolom versi baru.
    const familyCount = await client.query(
      'SELECT COUNT(*)::int AS total FROM public.families'
    );

    if (familyCount.rows[0].total === 0) {
      await client.query(`
        ALTER TABLE public.families
          ALTER COLUMN family_card_number DROP NOT NULL,
          ALTER COLUMN head_name DROP NOT NULL,
          ALTER COLUMN rt_number DROP NOT NULL,
          ALTER COLUMN rw_number DROP NOT NULL;
      `);
    }

    const residentCount = await client.query(
      'SELECT COUNT(*)::int AS total FROM public.residents'
    );

    if (residentCount.rows[0].total === 0) {
      await client.query(`
        ALTER TABLE public.residents
          ALTER COLUMN name DROP NOT NULL,
          ALTER COLUMN gender DROP NOT NULL;
      `);
    }

    // Pertahankan email, tetapi izinkan username digunakan
    // tanpa harus mengisi kolom email versi lama.
    await client.query(`
      ALTER TABLE public.users
        ALTER COLUMN email DROP NOT NULL,
        ALTER COLUMN rw_number DROP NOT NULL;
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username
      ON public.users (lower(username))
      WHERE username IS NOT NULL AND username <> '';
    `);

    // Terapkan skema lokal untuk membuat tabel yang belum tersedia.
    // CREATE TABLE IF NOT EXISTS tidak menghapus tabel lama.
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Pastikan baris DROP yang dikomentari tetap tidak dieksekusi.
    if (/^\s*DROP\s+TABLE/im.test(schema)) {
      throw new Error(
        'Ditemukan perintah DROP TABLE aktif. Tidak ada perubahan disimpan.'
      );
    }

    await client.query(schema);
    await client.query('COMMIT');

    console.log('');
    console.log('Perbaikan skema selesai.');
    console.log('Data lama tidak dihapus.');
    console.log('Akun pengguna yang ada tetap dipertahankan.');

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.table(tables.rows);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Perbaikan dibatalkan:', err.message);
    console.error('Transaksi perubahan telah di-rollback.');
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
