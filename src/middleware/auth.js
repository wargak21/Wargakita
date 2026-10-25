exports.requireLogin = (req, res, next) => {
  if (req.session.user) return next();
  return res.redirect('/login');
};
exports.requireRole = (...roles) => (req, res, next) => {
  if (roles.includes(req.session.user.role)) return next();
  return res.status(403).render('pages/error', { title: 'Akses ditolak', code: 403, message: 'Anda tidak memiliki akses ke halaman ini.' });
};
