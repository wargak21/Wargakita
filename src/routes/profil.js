const router = require('express').Router();
const { query } = require('../config/db');
const asyncH = require('../utils/async');
const { requireRole } = require('../middleware/auth');
const { clearProfilCache } = require('../services/profil');

router.get('/', asyncH(async (req, res) => {
  const u = req.session.user;
  const pengurus = (await query("SELECT name, role, rt, phone FROM users WHERE rw=$1 AND role IN ('rt','rw') ORDER BY role DESC, rt", [u.rw || ''])).rows;
  res.render('profil/index', { title: 'Profil RT/RW', active: 'profil', pengurus });
}));
router.post('/', requireRole('rw'), asyncH(async (req, res) => {
  const b = req.body; const t = (k) => String(b[k] || '').trim() || null;
  await query(
    `UPDATE lingkungan_profil SET nama=COALESCE($1,nama), kelurahan=$2, kecamatan=$3, kota=$4, alamat=$5, telp_rt=$6, telp_rw=$7,
     iuran_bulanan=$8 WHERE id=1`,
    [t('nama'), t('kelurahan'), t('kecamatan'), t('kota'), t('alamat'), t('telp_rt'), t('telp_rw'), parseInt(b.iuran_bulanan, 10) || 100000]);
  clearProfilCache();
  req.session.flash = { type: 'success', text: 'Profil lingkungan diperbarui.' };
  res.redirect('/profil');
}));

module.exports = router;
