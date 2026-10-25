const router = require('express').Router();
const { query } = require('../config/db');
const asyncH = require('../utils/async');
const { requireRole } = require('../middleware/auth');
const { scope } = require('../utils/scope');
const csv = require('../utils/csv');

const staff = requireRole('rt', 'rw');
const PER = 10;

function baseWhere(u, p) {
  let w = 'WHERE 1=1' + scope(u, p, 'f');
  if (u.role === 'warga') { p.push(u.family_id || 0); w += ` AND r.family_id=$${p.length}`; }
  return w;
}
async function familiesFor(u) {
  const p = [];
  return (await query(`SELECT f.id, f.no_kk, f.kepala_keluarga, f.rt FROM families f WHERE 1=1${scope(u, p, 'f')} ORDER BY f.rt, f.kepala_keluarga`, p)).rows;
}
async function familyAllowed(u, id) {
  const p = [id];
  const r = await query(`SELECT 1 FROM families f WHERE f.id=$1${scope(u, p, 'f')}`, p);
  return r.rowCount > 0;
}
async function residentAllowed(u, id) {
  const p = [id];
  const r = await query(`SELECT r.id FROM residents r JOIN families f ON f.id=r.family_id WHERE r.id=$1${scope(u, p, 'f')}`, p);
  return r.rowCount > 0;
}
const clean = (b) => ({
  family_id: parseInt(b.family_id, 10) || null,
  nik: String(b.nik || '').trim(),
  nama: String(b.nama || '').trim(),
  jenis_kelamin: b.jenis_kelamin === 'P' ? 'P' : 'L',
  tempat_lahir: String(b.tempat_lahir || '').trim() || null,
  tgl_lahir: b.tgl_lahir || null,
  hubungan: String(b.hubungan || '').trim() || null,
  status: b.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
});
const back = (req, res, type, text, to) => { req.session.flash = { type, text }; res.redirect(to); };

router.get('/', asyncH(async (req, res) => {
  const u = req.session.user;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const q = String(req.query.q || '').trim(), rt = String(req.query.rt || ''), status = String(req.query.status || '');
  const p = []; let w = baseWhere(u, p);
  if (q) { p.push(`%${q}%`); w += ` AND (r.nama ILIKE $${p.length} OR r.nik ILIKE $${p.length} OR f.no_kk ILIKE $${p.length})`; }
  if (rt && u.role === 'rw') { p.push(rt); w += ` AND f.rt=$${p.length}`; }
  if (status) { p.push(status); w += ` AND r.status=$${p.length}`; }
  const total = (await query(`SELECT COUNT(*) c FROM residents r JOIN families f ON f.id=r.family_id ${w}`, p)).rows[0].c;
  const rows = (await query(`SELECT r.*, f.no_kk, f.rt, f.rw FROM residents r JOIN families f ON f.id=r.family_id ${w} ORDER BY f.rt, r.nama LIMIT ${PER} OFFSET ${(page - 1) * PER}`, p)).rows;
  const sp = []; const sw = baseWhere(u, sp);
  const st = (await query(`SELECT COUNT(*) total, COUNT(*) FILTER (WHERE r.jenis_kelamin='L') l, COUNT(*) FILTER (WHERE r.jenis_kelamin='P') pr, COUNT(DISTINCT r.family_id) kk FROM residents r JOIN families f ON f.id=r.family_id ${sw}`, sp)).rows[0];
  const rtList = u.role === 'rw' ? (await query('SELECT DISTINCT rt FROM families WHERE rw=$1 ORDER BY rt', [u.rw])).rows.map((x) => x.rt) : [];
  res.render('warga/index', { title: 'Data Warga', active: 'warga', rows, st, rtList, f: { q, rt, status }, pg: { page, pages: Math.max(1, Math.ceil(total / PER)), total, per: PER } });
}));

router.get('/export', staff, asyncH(async (req, res) => {
  const p = []; const w = baseWhere(req.session.user, p);
  const rows = (await query(`SELECT r.nik, r.nama, r.jenis_kelamin, r.tempat_lahir, r.tgl_lahir, r.hubungan, f.no_kk, f.rt, f.rw, r.status FROM residents r JOIN families f ON f.id=r.family_id ${w} ORDER BY f.rt, r.nama`, p)).rows;
  csv.send(res, 'data-warga.csv', ['nik', 'nama', 'jenis_kelamin', 'tempat_lahir', 'tgl_lahir', 'hubungan', 'no_kk', 'rt', 'rw', 'status'],
    rows.map((r) => [r.nik, r.nama, r.jenis_kelamin, r.tempat_lahir, r.tgl_lahir, r.hubungan, r.no_kk, r.rt, r.rw, r.status]));
}));

router.get('/import', staff, (req, res) => res.render('warga/import', { title: 'Import Warga', active: 'warga' }));
router.post('/import', staff, asyncH(async (req, res) => {
  const u = req.session.user;
  const data = csv.parse(req.body.csv);
  if (data.length < 2) return back(req, res, 'error', 'File CSV kosong atau tidak valid.', '/warga/import');
  if (data.length > 1001) return back(req, res, 'error', 'Maksimal 1000 baris per import.', '/warga/import');
  const head = data[0].map((h) => h.trim().toLowerCase());
  const idx = (n) => head.indexOf(n);
  if (idx('nik') < 0 || idx('nama') < 0 || idx('no_kk') < 0) return back(req, res, 'error', 'Header wajib: nik, nama, no_kk.', '/warga/import');
  const fams = new Map((await familiesFor(u)).map((f) => [f.no_kk, f.id]));
  let ok = 0, skip = 0;
  for (const r of data.slice(1)) {
    const g = (n) => (idx(n) >= 0 ? String(r[idx(n)] || '').trim() : '');
    const fid = fams.get(g('no_kk'));
    if (!fid || !/^\d{16}$/.test(g('nik')) || !g('nama')) { skip++; continue; }
    const res2 = await query(
      `INSERT INTO residents (family_id,nik,nama,jenis_kelamin,tempat_lahir,tgl_lahir,hubungan,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (nik) DO NOTHING`,
      [fid, g('nik'), g('nama'), g('jenis_kelamin').toUpperCase().startsWith('P') ? 'P' : 'L', g('tempat_lahir') || null,
        /^\d{4}-\d{2}-\d{2}$/.test(g('tgl_lahir')) ? g('tgl_lahir') : null, g('hubungan') || null, g('status') === 'Nonaktif' ? 'Nonaktif' : 'Aktif']);
    res2.rowCount ? ok++ : skip++;
  }
  back(req, res, 'success', `Import selesai: ${ok} data masuk, ${skip} dilewati (KK tidak ditemukan / NIK tidak valid / sudah ada).`, '/warga');
}));

router.get('/baru', staff, asyncH(async (req, res) => {
  res.render('warga/form', { title: 'Tambah Warga', active: 'warga', item: null, families: await familiesFor(req.session.user) });
}));
router.post('/', staff, asyncH(async (req, res) => {
  const u = req.session.user; const d = clean(req.body);
  if (!/^\d{16}$/.test(d.nik) || !d.nama || !d.family_id) return back(req, res, 'error', 'NIK (16 digit), nama, dan KK wajib diisi.', '/warga/baru');
  if (!(await familyAllowed(u, d.family_id))) return back(req, res, 'error', 'KK tidak valid.', '/warga/baru');
  try {
    await query('INSERT INTO residents (family_id,nik,nama,jenis_kelamin,tempat_lahir,tgl_lahir,hubungan,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [d.family_id, d.nik, d.nama, d.jenis_kelamin, d.tempat_lahir, d.tgl_lahir, d.hubungan, d.status]);
  } catch (e) {
    if (e.code === '23505') return back(req, res, 'error', 'NIK sudah terdaftar.', '/warga/baru');
    throw e;
  }
  back(req, res, 'success', 'Data warga ditambahkan.', '/warga');
}));
router.get('/:id/edit', staff, asyncH(async (req, res) => {
  const u = req.session.user; const id = parseInt(req.params.id, 10) || 0;
  if (!(await residentAllowed(u, id))) return res.status(404).render('pages/error', { title: '404', code: 404, message: 'Data tidak ditemukan.' });
  const item = (await query('SELECT * FROM residents WHERE id=$1', [id])).rows[0];
  res.render('warga/form', { title: 'Ubah Warga', active: 'warga', item, families: await familiesFor(u) });
}));
router.post('/:id', staff, asyncH(async (req, res) => {
  const u = req.session.user; const id = parseInt(req.params.id, 10) || 0; const d = clean(req.body);
  const to = `/warga/${id}/edit`;
  if (!(await residentAllowed(u, id)) || !(await familyAllowed(u, d.family_id || 0))) return back(req, res, 'error', 'Data tidak valid.', '/warga');
  if (!/^\d{16}$/.test(d.nik) || !d.nama) return back(req, res, 'error', 'NIK (16 digit) dan nama wajib diisi.', to);
  try {
    await query('UPDATE residents SET family_id=$1,nik=$2,nama=$3,jenis_kelamin=$4,tempat_lahir=$5,tgl_lahir=$6,hubungan=$7,status=$8 WHERE id=$9',
      [d.family_id, d.nik, d.nama, d.jenis_kelamin, d.tempat_lahir, d.tgl_lahir, d.hubungan, d.status, id]);
  } catch (e) {
    if (e.code === '23505') return back(req, res, 'error', 'NIK sudah dipakai warga lain.', to);
    throw e;
  }
  back(req, res, 'success', 'Data warga diperbarui.', '/warga');
}));
router.post('/:id/hapus', staff, asyncH(async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  if (!(await residentAllowed(req.session.user, id))) return back(req, res, 'error', 'Data tidak ditemukan.', '/warga');
  await query('DELETE FROM residents WHERE id=$1', [id]);
  back(req, res, 'success', 'Data warga dihapus.', '/warga');
}));

module.exports = router;
