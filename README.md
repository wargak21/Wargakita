# WargaKita — Sistem Informasi RT/RW

MVP aplikasi Node.js + Express + EJS + MySQL dengan tiga role:
- **RW / Staff RW**: melihat data warga dan keluarga seluruh RT dalam RW, memproses persetujuan tahap RW, mengatur informasi surat.
- **RT**: melihat data warga/keluarga hanya pada RT yang ditugaskan, memproses persetujuan tahap RT.
- **Warga**: melihat anggota keluarga sendiri, mengajukan surat online, melihat jumlah warga di RT dan RW, mengunduh PDF setelah persetujuan RT dan RW.

## Prasyarat
- Node.js 20 atau lebih baru
- MySQL 8.x (atau kompatibel)
- VS Code (opsional)

## Instalasi Windows / PowerShell
1. Ekstrak ZIP ke folder kerja, lalu buka folder `rt-rw-digital` di VS Code.
2. Buka terminal di folder proyek.
3. Jalankan `npm install`.
4. Salin `.env.example` menjadi `.env`, lalu sesuaikan DB host/user/password dan `SESSION_SECRET`.
5. Jalankan schema: `mysql -u root -p < database/schema.sql` (jika password MySQL kosong, hilangkan `-p`; atau buka `database/schema.sql` melalui MySQL Workbench dan jalankan).
6. Buat akun dengan password hash bcrypt melalui `node scripts/create-user.js` (petunjuk ada di bawah). Jangan gunakan akun demo untuk deployment.
7. Jalankan `npm start`, lalu buka `http://localhost:3000`.

## Membuat akun pertama
Buat file `.env` lebih dulu, kemudian jalankan:
```powershell
node scripts/create-user.js
```
Script meminta input melalui variabel environment. Contoh:
```powershell
$env:SEED_NAME="Staff RW"
$env:SEED_EMAIL="rw@example.test"
$env:SEED_PASSWORD="GantiPassword123!"
$env:SEED_ROLE="rw"
$env:SEED_RW="05"
node scripts/create-user.js
```
Untuk role `rt`, set `$env:SEED_RT="01"` dan `$env:SEED_ROLE="rt"`. Untuk role `warga`, buat data keluarga + warga terlebih dahulu dan set `SEED_FAMILY_ID`.

## Fitur & batasan MVP
- Autentikasi sesi, password bcrypt, pembatasan akses di server.
- Pengajuan surat dan approval berurutan RT → RW.
- PDF hanya dapat diunduh jika status `Disetujui`.
- PDF saat ini menampilkan teks placeholder cap RT/RW dan nama pejabat, **belum** memasukkan gambar cap resmi atau tanda tangan digital tersertifikasi.
- Pengelolaan CRUD warga/keluarga, unggah foto/video, notifikasi, audit log, CSRF protection, reset password, dan pengaturan session store produksi belum termasuk MVP ini.
- Sebelum produksi: pasang HTTPS, CSRF protection, rate limit login, session store persisten, audit log, backup DB, validasi hukum surat, serta gambar stempel dan tanda tangan dengan otorisasi tertulis.
