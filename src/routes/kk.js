const router = require('express').Router();
const { query } = require('../config/db');
const asyncH = require('../utils/async');
const { requireRole } = require('../middleware/auth');
const { scope } = require('../utils/scope');
const csv = require('../utils/csv');

const staff = requireRole('rt', 'rw');
const PER = 10;
const back = (req, res, type, text, to) => { req.session.flash = { type, text }; res.redirect(to); };

function famWhere(u, p) {
  let w = 'WHERE 1=1' + scope(u, p, 'f');
  if (u.role === 'warga') { p.push(u.family_id || 0); w += ` AND f.id=$${p.length}`; }
  return w;
}
const MEMBERS = "(SELECT COUNT(*) FROM residents r WHERE r.family_id=f.id AND r.status='Aktif')";

router.get('/', asyncH(async (req, res) => {
  const u = req.session.user;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const q = String(req.query.q || '').trim(), rt = String(req.query.rt || '');
  const p = []; let w = famWhere(u, p);
  if (q) { p.push(`%${q}%`); w += ` AND (f.no_kk ILIKE $${p.length} OR f.kepala_keluarga ILIKE $${p.length})`; }
  if (rt && u.role === 'rw') { p.push(rt); w += ` AND f.rt=$${p.length}`; }
  const total = (await query(`SELECT COUNT(*) c FROM families f ${w}`, p)).rows[0].c;
  const rows = (await query(`SELECT f.*, ${MEMBERS} AS anggota FROM families f ${w} ORDER BY f.rt, f.kepala_keluarga LIMIT ${PER} OFFSET ${(page - 1) * PER}`, p)).rows;
  const sp = []; const sw = famWhere(u, sp);
  const st = (await query(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE f.status='Aktif') aktif, COUNT(*) FILTER (WHERE f.status='Nonaktif') nonaktif FROM families f ${sw}`, sp)).rows[0];
  const rtList = u.role === 'rw' ? (await query('SELECT DISTINCT rt FROM families WHERE rw=$1 ORDER BY rt', [u.rw])).rows.map((x) => x.rt) : [];
  res.render('kk/index', { title: 'Kartu Keluarga', active: 'kk', rows, st, rtList, f: { q, rt }, pg: { page, pages: Math.max(1, Math.ceil(total / PER)), total, per: PER } });
}));

router.get('/export', staff, asyncH(async (req, res) => {
  const p = []; const w = famWhere(req.session.user, p);
  const rows = (await query(`SELECT f.no_kk, f.kepala_keluarga, f.alamat, f.rt, f.rw, f.status, ${MEMBERS} AS anggota FROM families f ${w} ORDER BY f.rt, f.kepala_keluarga`, p)).rows;
  csv.send(res, 'kartu-keluarga.csv', ['no_kk', 'kepala_keluarga', 'alamat', 'rt', 'rw', 'status', 'anggota'],
    rows.map((r) => [r.no_kk, r.kepala_keluarga, r.alamat, r.rt, r.rw, r.status, r.anggota]));
}));

router.get('/baru', staff, (req, res) => res.render('kk/form', { title: 'Tambah KK', active: 'kk', item: null }));
router.post('/', staff, asyncH(async (req, res) => {
  const u = req.session.user; const b = req.body;
  const no_kk = String(b.no_kk || '').trim(), kepala = String(b.kepala_keluarga || '').trim();
  const rt = u.role === 'rt' ? u.rt : String(b.rt || '').trim();
  if (!/^\d{16}$/.test(no_kk) || !kepala || !/^\d{1,3}$/.test(rt)) return back(req, res, 'error', 'No. KK (16 digit), kepala keluarga, dan RT wajib diisi.', '/kk/baru');
  try {
    await query('INSERT INTO families (no_kk,kepala_keluarga,alamat,rt,rw,status) VALUES ($1,$2,$3,$4,$5,$6)',
      [no_kk, kepala, String(b.alamat || '').trim() || null, rt, u.rw, b.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif']);
  } catch (e) {
    if (e.code === '23505') return back(req, res, 'error', 'No. KK sudah terdaftar.', '/kk/baru');
    throw e;
  }
  back(req, res, 'success', 'Kartu keluarga ditambahkan.', '/kk');
}));

router.get('/:id', asyncH(async (req, res) => {
  const u = req.session.user; const id = parseInt(req.params.id, 10) || 0;
  const p = [id]; const w = famWhere(u, p) + ' AND f.id=$1';
  const fam = (await query(`SELECT f.* FROM families f ${w}`, p)).rows[0];
  if (!fam) return res.status(404).render('pages/error', { title: '404', code: 404, message: 'Data tidak ditemukan.' });
  const members = (await query('SELECT * FROM residents WHERE family_id=$1 ORDER BY (hubungan ILIKE $2) DESC, nama', [id, 'kepala%'])).rows;
  res.render('kk/detail', { title: 'Detail KK', active: 'kk', fam, members });
}));
router.get('/:id/edit', staff, asyncH(async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0; const p = [id];
  const item = (await query(`SELECT f.* FROM families f WHERE f.id=$1${scope(req.session.user, p, 'f')}`, p)).rows[0];
  if (!item) return res.status(404).render('pages/error', { title: '404', code: 404, message: 'Data tidak ditemukan.' });
  res.render('kk/form', { title: 'Ubah KK', active: 'kk', item });
}));
router.post('/:id', staff, asyncH(async (req, res) => {
  const u = req.session.user; const id = parseInt(req.params.id, 10) || 0; const b = req.body;
  const no_kk = String(b.no_kk || '').trim(), kepala = String(b.kepala_keluarga || '').trim();
  const rt = u.role === 'rt' ? u.rt : String(b.rt || '').trim();
  if (!/^\d{16}$/.test(no_kk) || !kepala || !/^\d{1,3}$/.test(rt)) return back(req, res, 'error', 'Data tidak lengkap.', `/kk/${id}/edit`);
  const p = [no_kk, kepala, String(b.alamat || '').trim() || null, rt, b.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif', id];
  try {
    await query(`UPDATE families f SET no_kk=$1,kepala_keluarga=$2,alamat=$3,rt=$4,status=$5 WHERE f.id=$6${scope(u, p, 'f')}`, p);
  } catch (e) {
    if (e.code === '23505') return back(req, res, 'error', 'No. KK sudah dipakai.', `/kk/${id}/edit`);
    throw e;
  }
  back(req, res, 'success', 'Kartu keluarga diperbarui.', '/kk');
}));
router.post('/:id/hapus', staff, asyncH(async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0; const p = [id];
  try {
    await query(`DELETE FROM families f WHERE f.id=$1${scope(req.session.user, p, 'f')}`, p);
  } catch (e) {
    if (e.code === '23503') return back(req, res, 'error', 'KK masih memiliki anggota. Hapus/pindahkan anggota terlebih dulu.', '/kk');
    throw e;
  }
  back(req, res, 'success', 'Kartu keluarga dihapus.', '/kk');
}));

module.exports = router;
