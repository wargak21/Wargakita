USE rt_rw_digital;
-- Jalankan setelah schema.sql. Password demo: password (gunakan hanya untuk pengujian lokal).
INSERT IGNORE INTO families (id,family_card_number,head_name,address,rt_number,rw_number) VALUES
(1,'3175010101010001','Budi Santoso','Jl. Melati No. 10','01','05'),
(2,'3175010101010002','Siti Nurhaliza','Jl. Mawar No. 12','01','05'),
(3,'3175010101010003','Agus Setiawan','Jl. Kenanga No. 4','02','05');
INSERT IGNORE INTO users (id,name,email,password_hash,role,rt_number,rw_number,family_id) VALUES
(1,'Staff RW','rw@example.test','$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','rw',NULL,'05',NULL),
(2,'Ketua RT 01','rt01@example.test','$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','rt','01','05',NULL),
(3,'Budi Santoso','warga@example.test','$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','warga',NULL,'05',1);
INSERT IGNORE INTO residents (id,user_id,family_id,nik,name,gender,birth_date,occupation,status) VALUES
(1,3,1,'3175010101010001','Budi Santoso','Laki-laki','1985-01-01','Karyawan','Aktif'),
(2,NULL,1,'3175010101010002','Ani Santoso','Perempuan','1988-02-02','Ibu Rumah Tangga','Aktif'),
(3,NULL,2,'3175010101010003','Siti Nurhaliza','Perempuan','1990-03-03','Wiraswasta','Aktif'),
(4,NULL,3,'3175010101010004','Agus Setiawan','Laki-laki','1982-04-04','Pegawai','Aktif');
-- Akun demo memakai hash bcrypt contoh untuk password 'password'. Lebih aman buat akun sendiri via scripts/create-user.js.
