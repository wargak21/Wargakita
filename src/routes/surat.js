const router = require('express').Router();
const PDFDocument = require('pdfkit');
const { query } = require('../config/db');
const asyncH = require('../utils/async');
const { requireRole } = require('../middleware/auth');
const { scope } = require('../utils/scope');
const { tanggal, todayStr } = require('../utils/format');

const PER = 10;
const JENIS = ['Surat Keterangan Domisili', 'Surat Pengantar Pindah', 'Surat Keterangan Usaha', 'Surat Pengantar Nikah',
  'Surat Keterangan Tidak Mampu', 'Surat Pengantar SKCK', 'Surat Keterangan Lainnya'];
const STATUS = ['Menunggu RT', 'Diverifikasi RT', 'Selesai', 'Ditolak'];
const back = (req, res, type, text, to = '/surat') => { req.session.flash = { type, text }; res.redirect(to); };

function where(u, p) {
  let w = 'WHERE 1=1' + scope(u, p, 'f');
  if (u.role === 'warga') { p.push(u.family_id || 0); w += ` AND l.family_id=$${p.length}`; }
  return w;
}
async function residentsFor(u) {
  const p = [];
  let w = "WHERE r.status='Aktif'" + scope(u, p, 'f');
  if (u.role === 'warga') { p.push(u.family_id || 0); w += ` AND r.family_id=$${p.length}`; }
  return (await query(`SELECT r.id, r.nama, r.nik, f.rt FROM residents r JOIN families f ON f.id=r.family_id ${w} ORDER BY f.rt, r.nama`, p)).rows;
}

router.get('/', asyncH(async (req, res) => {
  const u = req.session.user;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const q = String(req.query.q || '').trim(), status = STATUS.includes(req.query.status) ? req.query.status : '';
  const p = []; let w = where(u, p);
  if (q) { p.push(`%${q}%`); w += ` AND (l.nomor ILIKE $${p.length} OR l.pemohon_nama ILIKE $${p.length})`; }
  if (status) { p.push(status); w += ` AND l.status=$${p.length}`; }
  const total = (await query(`SELECT COUNT(*) c FROM letters l JOIN families f ON f.id=l.family_id ${w}`, p)).rows[0].c;
  const rows = (await query(`SELECT l.*, f.rt, f.rw FROM letters l JOIN families f ON f.id=l.family_id ${w} ORDER BY l.created_at DESC LIMIT ${PER} OFFSET ${(page - 1) * PER}`, p)).rows;
  res.render('surat/index', { title: 'Surat Pengantar', active: 'surat', rows, STATUS, f: { q, status }, pg: { page, pages: Math.max(1, Math.ceil(total / PER)), total, per: PER } });
}));

router.get('/baru', asyncH(async (req, res) => {
  res.render('surat/form', { title: 'Ajukan Surat', active: 'surat', JENIS, residents: await residentsFor(req.session.user) });
}));
router.post('/', asyncH(async (req, res) => {
  const u = req.session.user; const b = req.body;
  const jenis = JENIS.includes(b.jenis) ? b.jenis : null;
  const rid = parseInt(b.resident_id, 10) || 0;
  const pp = [rid]; let w = 'WHERE r.id=$1' + scope(u, pp, 'f');
  if (u.role === 'warga') { pp.push(u.family_id || 0); w += ` AND r.family_id=$${pp.length}`; }
  const r = (await query(`SELECT r.id, r.nama, r.family_id, f.rt, f.rw FROM residents r JOIN families f ON f.id=r.family_id ${w}`, pp)).rows[0];
  if (!jenis || !r) return back(req, res, 'error', 'Jenis surat dan pemohon wajib dipilih.', '/surat/baru');
  const ins = await query('INSERT INTO letters (jenis,family_id,resident_id,pemohon_nama,keperluan,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [jenis, r.family_id, r.id, r.nama, String(b.keperluan || '').trim() || null, u.id]);
  const id = ins.rows[0].id;
  const nomor = `${String(id).padStart(3, '0')}/RT${r.rt}/RW${r.rw}/${todayStr().slice(0, 4)}`;
  await query('UPDATE letters SET nomor=$1 WHERE id=$2', [nomor, id]);
  back(req, res, 'success', `Pengajuan surat ${nomor} dikirim. Menunggu persetujuan RT.`);
}));

// Persetujuan RT -> RW
async function decide(req, res, from, to, byCol, atCol, role) {
  const u = req.session.user; const id = parseInt(req.params.id, 10) || 0;
  const setuju = req.body.aksi === 'setuju';
  const p = [setuju ? to : 'Ditolak', u.id, String(req.body.catatan || '').trim() || null, id, from, u.rw];
  let extra = '';
  if (role === 'rt') { p.push(u.rt); extra = ` AND f.rt=$${p.length}`; }
  const r = await query(
    `UPDATE letters l SET status=$1, ${byCol}=$2, ${atCol}=now(), catatan=$3
     FROM families f WHERE l.family_id=f.id AND l.id=$4 AND l.status=$5 AND f.rw=$6${extra}`, p);
  if (!r.rowCount) return back(req, res, 'error', 'Surat tidak ditemukan atau status sudah berubah.');
  back(req, res, 'success', setuju ? 'Surat disetujui.' : 'Surat ditolak.');
}
router.post('/:id/rt', requireRole('rt'), asyncH((req, res) => decide(req, res, 'Menunggu RT', 'Diverifikasi RT', 'rt_by', 'rt_at', 'rt')));
router.post('/:id/rw', requireRole('rw'), asyncH((req, res) => decide(req, res, 'Diverifikasi RT', 'Selesai', 'rw_by', 'rw_at', 'rw')));

router.get('/:id/pdf', asyncH(async (req, res) => {
  const u = req.session.user; const id = parseInt(req.params.id, 10) || 0;
  const p = [id]; const w = where(u, p) + ' AND l.id=$1';
  const l = (await query(
    `SELECT l.*, f.rt, f.rw, f.alamat, f.no_kk, r.nik, r.tempat_lahir, r.tgl_lahir, r.jenis_kelamin
     FROM letters l JOIN families f ON f.id=l.family_id LEFT JOIN residents r ON r.id=l.resident_id ${w}`, p)).rows[0];
  if (!l) return res.status(404).render('pages/error', { title: '404', code: 404, message: 'Surat tidak ditemukan.' });
  if (l.status !== 'Selesai') return back(req, res, 'error', 'PDF hanya dapat diunduh setelah disetujui RT dan RW.');
  const ketRT = (await query("SELECT name FROM users WHERE role='rt' AND rt=$1 AND rw=$2 LIMIT 1", [l.rt, l.rw])).rows[0];
  const ketRW = (await query("SELECT name FROM users WHERE role='rw' AND rw=$1 LIMIT 1", [l.rw])).rows[0];
  const pr = res.locals.profil || {};

  const doc = new PDFDocument({ size: 'A4', margin: 60 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="surat-${id}.pdf"`);
  doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(13).text(`RUKUN TETANGGA ${l.rt} / RUKUN WARGA ${l.rw}`, { align: 'center' });
  doc.fontSize(11).text(`KELURAHAN ${(pr.kelurahan || '-').toUpperCase()}, KECAMATAN ${(pr.kecamatan || '-').toUpperCase()}`, { align: 'center' });
  doc.font('Helvetica').fontSize(9).text(pr.alamat || '', { align: 'center' });
  doc.moveDown(0.5).moveTo(60, doc.y).lineTo(535, doc.y).lineWidth(1.5).stroke();
  doc.moveDown(1.5).font('Helvetica-Bold').fontSize(13).text(l.jenis.toUpperCase(), { align: 'center', underline: true });
  doc.font('Helvetica').fontSize(10).text(`Nomor: ${l.nomor}`, { align: 'center' });
  doc.moveDown(1.5).fontSize(11).text('Yang bertanda tangan di bawah ini, Ketua RT dan Ketua RW setempat, menerangkan bahwa:');
  doc.moveDown(0.8);
  const row = (k, v) => { const y = doc.y; doc.text(k, 80, y, { width: 120 }); doc.text(': ' + (v || '-'), 200, y, { width: 330 }); doc.moveDown(0.3); };
  row('Nama', l.pemohon_nama); row('NIK', l.nik);
  row('Tempat/Tgl Lahir', `${l.tempat_lahir || '-'}, ${tanggal(l.tgl_lahir)}`);
  row('Jenis Kelamin', l.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki');
  row('No. KK', l.no_kk); row('Alamat', `${l.alamat || '-'} RT ${l.rt}/RW ${l.rw}`);
  doc.x = 60; doc.moveDown(0.8);
  doc.text(`Benar yang bersangkutan adalah warga kami. Surat ini dibuat untuk keperluan: ${l.keperluan || '-'}.`, 60, doc.y, { width: 475, align: 'justify' });
  doc.moveDown(0.8).text('Demikian surat ini dibuat untuk dipergunakan sebagaimana mestinya.', 60, doc.y, { width: 475 });
  doc.moveDown(2).text(`${pr.kota || ''}, ${tanggal(l.rw_at || new Date())}`, 360, doc.y);
  const y = doc.y + 10;
  doc.text('Ketua RT ' + l.rt, 80, y, { width: 200, align: 'center' });
  doc.text('Ketua RW ' + l.rw, 340, y, { width: 200, align: 'center' });
  doc.moveDown(5);
  const y2 = doc.y;
  doc.font('Helvetica-Bold').text((ketRT && ketRT.name) || '(.....................)', 80, y2, { width: 200, align: 'center', underline: true });
  doc.text((ketRW && ketRW.name) || '(.....................)', 340, y2, { width: 200, align: 'center', underline: true });
  doc.font('Helvetica').fontSize(8).fillColor('#666').text('Disetujui secara elektronik melalui sistem WargaKita. Stempel & tanda tangan resmi belum disematkan.', 60, 760, { width: 475, align: 'center' });
  doc.end();
}));

module.exports = router;
