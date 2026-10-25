const router = require('express').Router();
const { query } = require('../config/db');
const asyncH = require('../utils/async');
const { scope } = require('../utils/scope');
const { todayStr } = require('../utils/format');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

async function countResidents(rw, rt) {
  const p = [rw]; let w = 'f.rw=$1';
  if (rt) { p.push(rt); w += ' AND f.rt=$2'; }
  const r = await query(`SELECT COUNT(*) c FROM residents r JOIN families f ON f.id=r.family_id WHERE r.status='Aktif' AND ${w}`, p);
  return r.rows[0].c;
}

router.get('/', asyncH(async (req, res) => {
  const u = req.session.user;
  const today = todayStr();
  const year = Number(today.slice(0, 4));
  const month = today.slice(0, 7);
  let cards;

  if (u.role === 'warga') {
    const fam = (await query("SELECT COUNT(*) c FROM residents WHERE family_id=$1 AND status='Aktif'", [u.family_id || 0])).rows[0].c;
    const rt = await countResidents(u.rw, u.rt);
    const rw = await countResidents(u.rw, null);
    const sur = (await query('SELECT COUNT(*) c FROM letters WHERE family_id=$1', [u.family_id || 0])).rows[0].c;
    cards = [
      { label: 'Anggota Keluarga', value: fam, sub: 'Keluarga Anda', ic: 'users', color: 'blue' },
      { label: 'Warga di RT ' + (u.rt || '-'), value: rt, sub: 'Warga aktif', ic: 'home', color: 'green' },
      { label: 'Warga di RW ' + (u.rw || '-'), value: rw, sub: 'Warga aktif', ic: 'users', color: 'purple' },
      { label: 'Surat Saya', value: sur, sub: 'Total pengajuan', ic: 'file', color: 'orange' },
    ];
  } else {
    let p = [];
    const wr = (await query(`SELECT COUNT(*) c FROM residents r JOIN families f ON f.id=r.family_id WHERE r.status='Aktif'${scope(u, p, 'f')}`, p)).rows[0].c;
    p = [];
    const kk = (await query(`SELECT COUNT(*) c FROM families f WHERE f.status='Aktif'${scope(u, p, 'f')}`, p)).rows[0].c;
    p = [u.role === 'rt' ? 'Menunggu RT' : 'Diverifikasi RT'];
    const sr = (await query(`SELECT COUNT(*) c FROM letters l JOIN families f ON f.id=l.family_id WHERE l.status=$1${scope(u, p, 'f')}`, p)).rows[0].c;
    p = [];
    const pg = (await query(`SELECT COUNT(*) c FROM complaints c WHERE c.status<>'Selesai'${scope(u, p, 'c')}`, p)).rows[0].c;
    cards = [
      { label: 'Total Warga', value: wr, sub: 'Warga aktif', ic: 'users', color: 'blue' },
      { label: 'Kepala Keluarga', value: kk, sub: 'KK aktif', ic: 'card', color: 'green' },
      { label: 'Surat Perlu Tindakan', value: sr, sub: 'Menunggu persetujuan Anda', ic: 'file', color: 'orange' },
      { label: 'Pengaduan Warga', value: pg, sub: 'Belum selesai', ic: 'message', color: 'purple' },
    ];
  }

  let p = [year];
  const rowsM = (await query(
    `SELECT EXTRACT(MONTH FROM d.periode)::int AS m, COALESCE(SUM(d.jumlah),0) AS total
     FROM dues d JOIN families f ON f.id=d.family_id
     WHERE d.status='Lunas' AND EXTRACT(YEAR FROM d.periode)=$1${scope(u, p, 'f')} GROUP BY 1`, p)).rows;
  const months = MONTHS.map((label, i) => ({ label, total: (rowsM.find((r) => r.m === i + 1) || {}).total || 0 }));
  const max = Math.max(...months.map((m) => m.total), 0);

  const ann = (await query('SELECT * FROM announcements WHERE rw=$1 ORDER BY tanggal DESC, id DESC LIMIT 4', [u.rw || ''])).rows;

  p = [month];
  const fin = (await query(
    `SELECT COALESCE(SUM(jumlah) FILTER (WHERE jenis='Pemasukan'),0) masuk,
            COALESCE(SUM(jumlah) FILTER (WHERE jenis='Pengeluaran'),0) keluar
     FROM transactions t WHERE to_char(t.tanggal,'YYYY-MM')=$1${scope(u, p, 't')}`, p)).rows[0];

  res.render('pages/dashboard', { title: 'Dashboard', active: 'dashboard', cards, months, max, ann, fin, year });
}));

module.exports = router;
