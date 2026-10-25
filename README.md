# WargaKita — Sistem Informasi RT/RW

Node.js + Express + EJS + **Supabase (PostgreSQL)**, di-deploy di **Vercel**.

## Fitur
Login · Dashboard · Data Warga (CRUD, filter, import/export CSV) · Kartu Keluarga · Surat Pengantar (alur RT → RW, PDF) ·
Pembayaran Iuran · Pengaduan Warga · Pengumuman · Laporan Keuangan (export CSV) · Profil RT/RW · Pengaturan (ubah password, kelola pengguna) · Tampilan responsif (mobile).

Role: **rw** (seluruh RW), **rt** (hanya RT-nya), **warga** (hanya keluarganya).
Keamanan: bcrypt, session di PostgreSQL, CSRF token, rate limit login, Helmet (CSP), RLS Supabase aktif.

## Struktur
```
api/index.js        entry Vercel
server.js           entry lokal
src/app.js          konfigurasi Express
src/config/db.js    koneksi PostgreSQL
src/middleware/     auth, csrf, locals
src/routes/         satu file per modul
src/utils/          format, csv, scope (pembatasan data per role), ikon
views/              partials/ + satu folder per modul
public/             css, js
database/schema.sql skema PostgreSQL
scripts/            init-db.js, create-user.js
```

## Menjalankan lokal
```bash
npm install
cp .env.example .env        # isi DATABASE_URL dan SESSION_SECRET
npm run db:init             # menerapkan database/schema.sql
# buat akun RW pertama (PowerShell):
$env:SEED_NAME="Ketua RW"; $env:SEED_USERNAME="rw05"; $env:SEED_PASSWORD="GantiPassword123!"
$env:SEED_ROLE="rw"; $env:SEED_RW="05"; npm run create-user
npm run dev                 # http://localhost:3000
```
Setelah login sebagai RW: isi Profil, tambah KK, tambah warga, lalu buat akun RT/warga di menu **Pengaturan**.

## Deploy Vercel
1. Environment Variables: `DATABASE_URL` (Supabase *Transaction pooler*, port 6543), `SESSION_SECRET`, `DB_SSL=true`.
2. Project Settings → Framework Preset = **Other**.
3. Push ke GitHub; Vercel akan build otomatis.

## Catatan
- Rate limit login memakai memori per-instance (di serverless sifatnya best-effort).
- PDF surat memuat teks nama pejabat; stempel/tanda tangan gambar belum disematkan.
- Satu lingkungan (satu RW) per database.
