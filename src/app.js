require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { pool } = require('./config/db');
const { attachLocals } = require('./middleware/locals');
const { csrfProtection } = require('./middleware/security');
const { requireLogin } = require('./middleware/auth');

const isProd = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
if (isProd && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET belum diset di environment variables.');

const app = express();
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      formAction: ["'self'"],
      upgradeInsecureRequests: isProd ? [] : null,
    },
  },
}));

app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: isProd ? '7d' : 0 }));

app.use(session({
  store: new PgSession({ pool, tableName: 'session', createTableIfMissing: false }),
  name: 'wk.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-ganti-di-produksi',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 1000 * 60 * 60 * 8 },
}));

app.use(attachLocals);
app.use(csrfProtection);

app.use('/', require('./routes/auth'));
app.use(requireLogin);
app.use('/', require('./routes/dashboard'));
app.use('/warga', require('./routes/warga'));
app.use('/kk', require('./routes/kk'));
app.use('/surat', require('./routes/surat'));
app.use('/iuran', require('./routes/iuran'));
app.use('/pengaduan', require('./routes/pengaduan'));
app.use('/pengumuman', require('./routes/pengumuman'));
app.use('/keuangan', require('./routes/keuangan'));
app.use('/profil', require('./routes/profil'));
app.use('/pengaturan', require('./routes/pengaturan'));

app.use((req, res) => res.status(404).render('pages/error', { title: 'Tidak ditemukan', code: 404, message: 'Halaman tidak ditemukan.' }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).render('pages/error', { title: 'Kesalahan', code: 500, message: 'Terjadi kesalahan pada server. Silakan coba lagi.' });
});

module.exports = app;
