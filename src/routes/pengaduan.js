const router = require('express').Router();
const { query } = require('../config/db');
const asyncH = require('../utils/async');
const { requireRole } = require('../middleware/auth');
const { scope } = require('../utils/scope');

const KATEGORI = ['Lingkungan', 'Fasilitas', 'Keamanan', 'Pelayanan', 'Kebersihan', 'Lainnya'];
const STATUS = ['Diterima', 'Dalam Proses', 'Selesai'];
const back = (req, res, type, text) => { req.session.flash = { type, text }; res.redirect('/pengaduan'); };

router.get('/', asyncH(async (req, res) => {
  const u = req.session.user;
  const status = STATUS.includes(req.query.status) ? req.query.status : '';
  const kategori = KATEGORI.includes(req.query.kategori) ? req.query.kategori : '';
  const q = String(req.query.q || '').trim();
  const p = []; let w = 'WHERE 1=1' + scope(u, p, 'c');
  if (u.role === 'warga') { p.push(u.id); w += ` AND c.user_id=$${p.length}`; }
  if (status) { p.push(status); w += ` AND c.status=$${p.length}`; }
  if (kategori) { p.push(kategori); w += ` AND c.kategori=$${p.length}`; }
  if (q) { p.push(`%${q}%`); w += ` AND (c.judul ILIKE $${p.length} OR c.nama_pelapor ILIKE $${p.length})`; }
  const rows = (await query(`SELECT c.* FROM complaints c ${w} ORDER BY c.tanggal DESC, c.id DESC LIMIT 200`, p)).rows;
  const st = { total: rows.length, proses: rows.filter((r) => r.status === 'Dalam Proses').length, selesai: rows.filter((r) => r.status === 'Selesai').length };
  res.render('pengaduan/index', { title: 'Pengaduan Warga', active: 'pengaduan', rows, st, KATEGORI, STATUS, f: { status, kategori, q } });
}));

router.post('/', asyncH(async (req, res) => {
  const u = req.session.user; const b = req.body;
  const judul = String(b.judul || '').trim();
  if (!judul || !KATEGORI.includes(b.kategori)) return back(req, res, 'error', 'Judul dan kategori wajib diisi.');
  await query('INSERT INTO complaints (user_id,nama_pelapor,kategori,judul,isi,rt,rw) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [u.id, u.name, b.kategori, judul, String(b.isi || '').trim() || null, u.rt, u.rw]);
  back(req, res, 'success', 'Pengaduan terkirim.');
}));

router.post('/:id/status', requireRole('rt', 'rw'), asyncH(async (req, res) => {
  const u = req.session.user; const id = parseInt(req.params.id, 10) || 0;
  if (!STATUS.includes(req.body.status)) return back(req, res, 'error', 'Status tidak valid.');
  const p = [req.body.status, String(req.body.tanggapan || '').trim() || null, id];
  const r = await query(`UPDATE complaints c SET status=$1, tanggapan=$2 WHERE c.id=$3${scope(u, p, 'c')}`, p);
  back(req, res, r.rowCount ? 'success' : 'error', r.rowCount ? 'Status pengaduan diperbarui.' : 'Pengaduan tidak ditemukan.');
}));

module.exports = router;
