const router = require('express').Router();
const { pool, query } = require('../config/db');
const asyncH = require('../utils/async');
const { requireRole } = require('../middleware/auth');
const { scope } = require('../utils/scope');
const { todayStr } = require('../utils/format');

const staff = requireRole('rt', 'rw');
const back = (req, res, type, text, to = '/iuran') => { req.session.flash = { type, text }; res.redirect(to); };
const validPeriode = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s || '');

router.get('/', asyncH(async (req, res) => {
  const u = req.session.user;
  const periode = req.query.periode === undefined ? todayStr().slice(0, 7) : String(req.query.periode);
  const rt = String(req.query.rt || ''), q = String(req.query.q || '').trim();
  const p = []; let w = 'WHERE 1=1' + scope(u, p, 'f');
  if (u.role === 'warga') { p.push(u.family_id || 0); w += ` AND d.family_id=$${p.length}`; }
  if (validPeriode(periode)) { p.push(periode + '-01'); w += ` AND d.periode=$${p.length}`; }
  if (rt && u.role === 'rw') { p.push(rt); w += ` AND f.rt=$${p.length}`; }
  if (q) { p.push(`%${q}%`); w += ` AND (f.kepala_keluarga ILIKE $${p.length} OR f.no_kk ILIKE $${p.length})`; }
  const rows = (await query(`SELECT d.*, f.kepala_keluarga, f.no_kk, f.rt, f.rw FROM dues d JOIN families f ON f.id=d.family_id ${w} ORDER BY d.periode DESC, f.rt, f.kepala_keluarga LIMIT 300`, p)).rows;
  const sum = rows.reduce((a, r) => { a.tagihan += r.jumlah; if (r.status === 'Lunas') a.lunas += r.jumlah; else a.belum += r.jumlah; return a; }, { tagihan: 0, lunas: 0, belum: 0 });
  const rtList = u.role === 'rw' ? (await query('SELECT DISTINCT rt FROM families WHERE rw=$1 ORDER BY rt', [u.rw])).rows.map((x) => x.rt) : [];
  res.render('iuran/index', { title: 'Pembayaran Iuran', active: 'iuran', rows, sum, rtList, f: { periode, rt, q } });
}));

router.post('/generate', staff, asyncH(async (req, res) => {
  const u = req.session.user; const periode = String(req.body.periode || '');
  if (!validPeriode(periode)) return back(req, res, 'error', 'Periode tidak valid.');
  const nominal = parseInt(req.body.jumlah, 10) || (res.locals.profil && res.locals.profil.iuran_bulanan) || 100000;
  const p = [periode + '-01', nominal];
  const r = await query(
    `INSERT INTO dues (family_id, periode, jumlah)
     SELECT f.id, $1::date, $2::numeric FROM families f WHERE f.status='Aktif'${scope(u, p, 'f')}
     ON CONFLICT (family_id, periode) DO NOTHING`, p);
  back(req, res, 'success', `${r.rowCount} tagihan iuran dibuat untuk periode ${periode}.`, `/iuran?periode=${periode}`);
}));

router.post('/:id/lunas', staff, asyncH(async (req, res) => {
  const u = req.session.user; const id = parseInt(req.params.id, 10) || 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const p = [u.id, id]; const extra = scope(u, p, 'f');
    const r = await client.query(
      `UPDATE dues d SET status='Lunas', tgl_bayar=CURRENT_DATE, dicatat_oleh=$1
       FROM families f WHERE d.family_id=f.id AND d.id=$2 AND d.status<>'Lunas'${extra}
       RETURNING d.id, d.jumlah, d.periode, f.kepala_keluarga, f.rt, f.rw`, p);
    if (!r.rowCount) { await client.query('ROLLBACK'); return back(req, res, 'error', 'Tagihan tidak ditemukan atau sudah lunas.'); }
    const d = r.rows[0];
    await client.query(
      "INSERT INTO transactions (tanggal, keterangan, jenis, jumlah, rt, rw, due_id) VALUES (CURRENT_DATE,$1,'Pemasukan',$2,$3,$4,$5)",
      [`Iuran ${String(d.periode).slice(0, 7)} - ${d.kepala_keluarga}`, d.jumlah, d.rt, d.rw, d.id]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  let to = '/iuran';
  try { const ref = new URL(req.get('Referer') || ''); if (ref.pathname === '/iuran') to = '/iuran' + ref.search; } catch (e) { /* abaikan */ }
  back(req, res, 'success', 'Pembayaran dicatat dan masuk ke laporan keuangan.', to);
}));

module.exports = router;
