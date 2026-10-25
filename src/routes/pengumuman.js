const router = require('express').Router();
const { query } = require('../config/db');
const asyncH = require('../utils/async');
const { requireRole } = require('../middleware/auth');

const staff = requireRole('rt', 'rw');
const back = (req, res, type, text) => { req.session.flash = { type, text }; res.redirect('/pengumuman'); };

router.get('/', asyncH(async (req, res) => {
  const u = req.session.user;
  const rows = (await query('SELECT a.*, u.name AS penulis FROM announcements a LEFT JOIN users u ON u.id=a.created_by WHERE a.rw=$1 ORDER BY a.tanggal DESC, a.id DESC LIMIT 100', [u.rw || ''])).rows;
  res.render('pengumuman/index', { title: 'Informasi & Pengumuman', active: 'pengumuman', rows });
}));
router.post('/', staff, asyncH(async (req, res) => {
  const u = req.session.user; const judul = String(req.body.judul || '').trim();
  if (!judul) return back(req, res, 'error', 'Judul wajib diisi.');
  await query('INSERT INTO announcements (judul,isi,rw,created_by) VALUES ($1,$2,$3,$4)', [judul, String(req.body.isi || '').trim() || null, u.rw, u.id]);
  back(req, res, 'success', 'Pengumuman dipublikasikan.');
}));
router.post('/:id/hapus', staff, asyncH(async (req, res) => {
  await query('DELETE FROM announcements WHERE id=$1 AND rw=$2', [parseInt(req.params.id, 10) || 0, req.session.user.rw]);
  back(req, res, 'success', 'Pengumuman dihapus.');
}));

module.exports = router;
