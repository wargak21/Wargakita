const { query } = require('../config/db');
let cache = null, at = 0;
exports.getProfil = async () => {
  if (cache && Date.now() - at < 5 * 60 * 1000) return cache;
  try {
    const { rows } = await query('SELECT * FROM lingkungan_profil WHERE id=1');
    cache = rows[0] || {}; at = Date.now();
  } catch (e) { cache = cache || {}; }
  return cache;
};
exports.clearProfilCache = () => { cache = null; };
