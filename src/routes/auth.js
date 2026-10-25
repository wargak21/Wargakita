const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { query } = require('../config/db');
const asyncH = require('../utils/async');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => {
    req.session.flash = { type: 'error', text: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' };
    res.redirect('/login');
  },
});

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('pages/login', { title: 'Masuk' });
});

router.post('/login', loginLimiter, asyncH(async (req, res, next) => {
  const ident = String(req.body.username || '').trim().toLowerCase();
  const pass = String(req.body.password || '');
  const { rows } = await query(
    `SELECT u.*, f.rt AS f_rt, f.rw AS f_rw FROM users u
     LEFT JOIN families f ON f.id = u.family_id
     WHERE lower(u.username)=$1 OR lower(u.email)=$1 LIMIT 1`, [ident]);
  const u = rows[0];
  const ok = u && (await bcrypt.compare(pass, u.password_hash));
  if (!ok) {
    req.session.flash = { type: 'error', text: 'Username atau password salah.' };
    return res.redirect('/login');
  }
  const remember = !!req.body.remember;
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = {
      id: u.id, name: u.name, role: u.role,
      rt: u.rt || u.f_rt || null, rw: u.rw || u.f_rw || null, family_id: u.family_id || null,
    };
    if (remember) req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;
    req.session.save((e) => (e ? next(e) : res.redirect('/')));
  });
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => { res.clearCookie('wk.sid'); res.redirect('/login'); });
});

module.exports = router;
