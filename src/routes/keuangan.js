const router = require('express').Router();
const { query } = require('../config/db');
const asyncH = require('../utils/async');
const { requireRole } = require('../middleware/auth');
const { scope } = require('../utils/scope');
const csv = require('../utils/csv');
const { todayStr } = require('../utils/format');

const staff = requireRole('rt', 'rw');
const back = (req, res, type, text, to = '/keuangan') => { req.session.flash = { type, text }; res.redirect(to); };
const validPeriode = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');

async function load(req) {
  const u = req.session.user;
  const periode = validPeriode(req.query.periode) ? req.query.periode : todayStr().slice(0, 7);
  const jenis = ['Pemasukan', 'Pengeluaran'].includes(req.query.jenis) ? req.query.jenis : '';
  const p = [periode]; let w = "WHERE to_char(t.tanggal,'YYYY-MM')=$1" + scope(u, p, 't');
  if (jenis) { p.push(jenis); w += ` AND t.jenis=$${p.length}`; }
  const rows = (await query(`SELECT t.* FROM transactions t ${w} ORDER BY t.tanggal DESC, t.id DESC LIMIT 500`, p)).rows;
  const sum = rows.reduce((a, r) => { a[r.jenis === 'Pemasukan' ? 'masuk' : 'keluar'] += r.jumlah; return a; }, { masuk: 0, keluar: 0 });
  return { periode, jenis, rows, sum };
}

router.get('/', asyncH(async (req, res) => {
  const u = req.session.user; const d = await load(req);
  const rtList = u.role === 'rw' ? (await query('SELECT DISTINCT rt FROM families WHERE rw=$1 ORDER BY rt', [u.rw])).rows.map((x) => x.rt) : [];
  res.render('keuangan/index', { title: 'Laporan Keuangan', active: 'keuangan', ...d, rtList });
}));

router.get('/export', asyncH(async (req, res) => {
  const d = await load(req);
  csv.send(res, `laporan-keuangan-${d.periode}.csv`, ['tanggal', 'keterangan', 'jenis', 'jumlah', 'rt'],
    d.rows.map((r) => [r.tanggal, r.keterangan, r.jenis, r.jumlah, r.rt]));
}));

router.post('/', staff, asyncH(async (req, res) => {
  const u = req.session.user; const b = req.body;
  const jumlah = parseInt(b.jumlah, 10);
  const ket = String(b.keterangan || '').trim();
  if (!ket || !(jumlah > 0) || !['Pemasukan', 'Pengeluaran'].includes(b.jenis)) return back(req, res, 'error', 'Keterangan, jenis, dan jumlah (>0) wajib diisi.');
  const rt = u.role === 'rt' ? u.rt : (String(b.rt || '').trim() || null);
  await query('INSERT INTO transactions (tanggal,keterangan,jenis,jumlah,rt,rw) VALUES ($1,$2,$3,$4,$5,$6)',
    [/^\d{4}-\d{2}-\d{2}$/.test(b.tanggal) ? b.tanggal : todayStr(), ket, b.jenis, jumlah, rt, u.rw]);
  back(req, res, 'success', 'Transaksi dicatat.');
}));
router.post('/:id/hapus', staff, asyncH(async (req, res) => {
  const u = req.session.user; const p = [parseInt(req.params.id, 10) || 0];
  await query(`DELETE FROM transactions t WHERE t.id=$1${scope(u, p, 't')}`, p);
  back(req, res, 'success', 'Transaksi dihapus.');
}));

module.exports = router;
