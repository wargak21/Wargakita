const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const asyncH = require('../utils/async');
const { requireRole } = require('../middleware/auth');

const back = (req, res, type, text) => { req.session.flash = { type, text }; res.redirect('/pengaturan'); };

router.get('/', asyncH(async (req, res) => {
  const u = req.session.user; let users = [], families = [];
  if (u.role === 'rw') {
    users = (await query('SELECT id,name,username,email,role,rt FROM users WHERE rw=$1 ORDER BY role, rt, name', [u.rw])).rows;
    families = (await query('SELECT id,no_kk,kepala_keluarga,rt FROM families WHERE rw=$1 ORDER BY rt, kepala_keluarga', [u.rw])).rows;
  }
  res.render('pengaturan/index', { title: 'Pengaturan', active: 'pengaturan', users, families });
}));

router.post('/password', asyncH(async (req, res) => {
  const u = req.session.user; const { lama, baru, konfirmasi } = req.body;
  if (!baru || baru.length < 8) return back(req, res, 'error', 'Password baru minimal 8 karakter.');
  if (baru !== konfirmasi) return back(req, res, 'error', 'Konfirmasi password tidak cocok.');
  const row = (await query('SELECT password_hash FROM users WHERE id=$1', [u.id])).rows[0];
  if (!row || !(await bcrypt.compare(String(lama || ''), row.password_hash))) return back(req, res, 'error', 'Password lama salah.');
  await query('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(baru, 10), u.id]);
  back(req, res, 'success', 'Password berhasil diubah.');
}));

router.post('/users', requireRole('rw'), asyncH(async (req, res) => {
  const u = req.session.user; const b = req.body;
  const role = ['rw', 'rt', 'warga'].includes(b.role) ? b.role : null;
  const name = String(b.name || '').trim(), username = String(b.username || '').trim();
  if (!role || !name || !username || String(b.password || '').length < 8) return back(req, res, 'error', 'Nama, username, role, dan password (min. 8 karakter) wajib diisi.');
  let rt = null, fid = null;
  if (role === 'rt') { rt = String(b.rt || '').trim(); if (!/^\d{1,3}$/.test(rt)) return back(req, res, 'error', 'Nomor RT wajib untuk role RT.'); }
  if (role === 'warga') {
    fid = parseInt(b.family_id, 10) || null;
    const f = fid ? (await query('SELECT id FROM families WHERE id=$1 AND rw=$2', [fid, u.rw])).rows[0] : null;
    if (!f) return back(req, res, 'error', 'Pilih KK untuk akun warga.');
  }
  try {
    await query('INSERT INTO users (name,username,email,password_hash,role,rt,rw,family_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [name, username, String(b.email || '').trim() || null, await bcrypt.hash(b.password, 10), role, rt, u.rw, fid]);
  } catch (e) {
    if (e.code === '23505') return back(req, res, 'error', 'Username atau email sudah dipakai.');
    throw e;
  }
  back(req, res, 'success', 'Akun pengguna dibuat.');
}));
router.post('/users/:id/hapus', requireRole('rw'), asyncH(async (req, res) => {
  const u = req.session.user; const id = parseInt(req.params.id, 10) || 0;
  if (id === u.id) return back(req, res, 'error', 'Tidak dapat menghapus akun sendiri.');
  await query('DELETE FROM users WHERE id=$1 AND rw=$2', [id, u.rw]);
  back(req, res, 'success', 'Akun dihapus.');
}));

module.exports = router;
