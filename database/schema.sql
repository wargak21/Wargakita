CREATE DATABASE IF NOT EXISTS rt_rw_digital CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rt_rw_digital;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('rw','rt','warga') NOT NULL,
  rt_number VARCHAR(5) NULL,
  rw_number VARCHAR(5) NOT NULL DEFAULT '05',
  family_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS families (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  family_card_number VARCHAR(30) NOT NULL UNIQUE,
  head_name VARCHAR(120) NOT NULL,
  address VARCHAR(255) NOT NULL,
  rt_number VARCHAR(5) NOT NULL,
  rw_number VARCHAR(5) NOT NULL DEFAULT '05',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS residents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  family_id BIGINT UNSIGNED NOT NULL,
  nik VARCHAR(16) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  gender ENUM('Laki-laki','Perempuan') NOT NULL,
  birth_date DATE NULL,
  occupation VARCHAR(120) NULL,
  status ENUM('Aktif','Pindah','Meninggal') NOT NULL DEFAULT 'Aktif',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS letters (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  resident_id BIGINT UNSIGNED NOT NULL,
  letter_type VARCHAR(120) NOT NULL,
  purpose TEXT NOT NULL,
  notes TEXT NULL,
  status ENUM('Menunggu RT','Menunggu RW','Disetujui','Ditolak RT','Ditolak RW') NOT NULL DEFAULT 'Menunggu RT',
  rt_approver BIGINT UNSIGNED NULL,
  rt_approved_at DATETIME NULL,
  rw_approver BIGINT UNSIGNED NULL,
  rw_approved_at DATETIME NULL,
  rejection_reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resident_id) REFERENCES residents(id),
  FOREIGN KEY (rt_approver) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (rw_approver) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id TINYINT PRIMARY KEY DEFAULT 1,
  community_name VARCHAR(160) NOT NULL DEFAULT 'Lingkungan RT/RW',
  chair_rt_name VARCHAR(120) NULL,
  chair_rw_name VARCHAR(120) NULL,
  rt_stamp_text VARCHAR(120) NOT NULL DEFAULT 'STEMPEL RT',
  rw_stamp_text VARCHAR(120) NOT NULL DEFAULT 'STEMPEL RW'
);
INSERT IGNORE INTO settings (id, community_name) VALUES (1, 'Lingkungan RT/RW');
