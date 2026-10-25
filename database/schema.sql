-- =====================================================================
-- WargaKita - Skema PostgreSQL (Supabase)
-- Jalankan di Supabase > SQL Editor, atau: npm run db:init
--
-- PERHATIAN: skema lama (MySQL/versi awal) memakai nama tabel yang mungkin
-- sama. Jika sudah ada tabel lama dengan kolom berbeda, backup datanya lalu
-- hapus dulu (hilangkan komentar blok DROP di bawah). Data lama akan HILANG.
-- =====================================================================
-- DROP TABLE IF EXISTS transactions, dues, complaints, announcements, letters, users, residents, families, lingkungan_profil CASCADE;

CREATE TABLE IF NOT EXISTS lingkungan_profil (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nama TEXT NOT NULL DEFAULT 'Lingkungan Contoh',
  kelurahan TEXT, kecamatan TEXT, kota TEXT, alamat TEXT,
  telp_rt TEXT, telp_rw TEXT,
  iuran_bulanan NUMERIC(12,0) NOT NULL DEFAULT 100000
);
INSERT INTO lingkungan_profil (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS families (
  id SERIAL PRIMARY KEY,
  no_kk VARCHAR(16) UNIQUE NOT NULL,
  kepala_keluarga TEXT NOT NULL,
  alamat TEXT,
  rt VARCHAR(3) NOT NULL,
  rw VARCHAR(3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif','Nonaktif')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_families_rw_rt ON families (rw, rt);

CREATE TABLE IF NOT EXISTS residents (
  id SERIAL PRIMARY KEY,
  family_id INT NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
  nik VARCHAR(16) UNIQUE NOT NULL,
  nama TEXT NOT NULL,
  jenis_kelamin CHAR(1) NOT NULL CHECK (jenis_kelamin IN ('L','P')),
  tempat_lahir TEXT,
  tgl_lahir DATE,
  hubungan TEXT,
  status TEXT NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif','Nonaktif')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_residents_family ON residents (family_id);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('rw','rt','warga')),
  rt VARCHAR(3),
  rw VARCHAR(3),
  family_id INT REFERENCES families(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username ON users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users (lower(email)) WHERE email IS NOT NULL AND email <> '';

CREATE TABLE IF NOT EXISTS letters (
  id SERIAL PRIMARY KEY,
  nomor TEXT,
  jenis TEXT NOT NULL,
  family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  resident_id INT REFERENCES residents(id) ON DELETE SET NULL,
  pemohon_nama TEXT NOT NULL,
  keperluan TEXT,
  status TEXT NOT NULL DEFAULT 'Menunggu RT'
    CHECK (status IN ('Menunggu RT','Diverifikasi RT','Selesai','Ditolak')),
  catatan TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  rt_by INT REFERENCES users(id) ON DELETE SET NULL, rt_at TIMESTAMPTZ,
  rw_by INT REFERENCES users(id) ON DELETE SET NULL, rw_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_letters_family ON letters (family_id);
CREATE INDEX IF NOT EXISTS idx_letters_status ON letters (status);

CREATE TABLE IF NOT EXISTS dues (
  id SERIAL PRIMARY KEY,
  family_id INT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  periode DATE NOT NULL,                       -- selalu tanggal 1 tiap bulan
  jumlah NUMERIC(12,0) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Belum Bayar' CHECK (status IN ('Lunas','Belum Bayar')),
  tgl_bayar DATE,
  dicatat_oleh INT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (family_id, periode)
);

CREATE TABLE IF NOT EXISTS complaints (
  id SERIAL PRIMARY KEY,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  nama_pelapor TEXT NOT NULL,
  kategori TEXT NOT NULL,
  judul TEXT NOT NULL,
  isi TEXT,
  status TEXT NOT NULL DEFAULT 'Diterima' CHECK (status IN ('Diterima','Dalam Proses','Selesai')),
  tanggapan TEXT,
  rt VARCHAR(3), rw VARCHAR(3)
);

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  judul TEXT NOT NULL,
  isi TEXT,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  rw VARCHAR(3) NOT NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  keterangan TEXT NOT NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('Pemasukan','Pengeluaran')),
  jumlah NUMERIC(14,0) NOT NULL CHECK (jumlah > 0),
  rt VARCHAR(3), rw VARCHAR(3) NOT NULL,
  due_id INT REFERENCES dues(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_trx_tanggal ON transactions (rw, tanggal);

-- Session store (connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL PRIMARY KEY,
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- KEAMANAN SUPABASE: aktifkan RLS tanpa policy agar tabel TIDAK bisa diakses
-- lewat Data API (anon key). Aplikasi ini memakai koneksi Postgres langsung
-- (role postgres) sehingga tetap berjalan normal.
ALTER TABLE lingkungan_profil ENABLE ROW LEVEL SECURITY;
ALTER TABLE families          ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE dues              ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints        ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session"         ENABLE ROW LEVEL SECURITY;
