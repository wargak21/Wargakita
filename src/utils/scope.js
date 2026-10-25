// Membatasi data sesuai role. RW: seluruh RW. RT & Warga: hanya RT-nya.
// Menambah parameter ke `params` dan mengembalikan potongan SQL " AND ...".
exports.scope = (user, params, alias = '') => {
  const p = alias ? alias + '.' : '';
  const c = [];
  if (user.rw) { params.push(user.rw); c.push(`${p}rw=$${params.length}`); }
  if (user.role !== 'rw' && user.rt) { params.push(user.rt); c.push(`${p}rt=$${params.length}`); }
  if (!user.rw) c.push('1=0');
  return c.length ? ' AND ' + c.join(' AND ') : '';
};
