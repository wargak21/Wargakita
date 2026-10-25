const f = require('../utils/format');
const { icon } = require('../utils/icons');
const { getProfil } = require('../services/profil');

exports.attachLocals = async (req, res, next) => {
  try {
    const s = req.session;
    res.locals.user = s.user || null;
    res.locals.flash = s.flash || null;
    delete s.flash;
    res.locals.currentPath = req.path;
    res.locals.params = req.query;
    res.locals.qs = (extra = {}) => new URLSearchParams({ ...req.query, ...extra }).toString();
    Object.assign(res.locals, { icon, rupiah: f.rupiah, tanggal: f.tanggal, bulanTahun: f.bulanTahun, badge: f.badge, roleLabel: f.roleLabel, todayLong: f.todayLong, todayStr: f.todayStr });
    res.locals.profil = s.user ? await getProfil() : {};
    next();
  } catch (e) { next(e); }
};
