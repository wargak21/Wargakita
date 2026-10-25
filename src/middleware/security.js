const crypto = require('crypto');
// Perlindungan CSRF berbasis token di session (field hidden _csrf pada setiap form POST)
exports.csrfProtection = (req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.body && req.body._csrf === req.session.csrf) return next();
  req.session.flash = { type: 'error', text: 'Formulir kedaluwarsa. Silakan coba lagi.' };
  return res.redirect(req.get('Referer') || '/');
};
