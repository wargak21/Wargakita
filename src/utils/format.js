const TZ = 'Asia/Jakarta';
exports.rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
exports.tanggal = (d) => {
  if (!d) return '-';
  const isStr = typeof d === 'string';
  const dt = isStr ? new Date(d.slice(0, 10) + 'T00:00:00Z') : new Date(d);
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: isStr ? 'UTC' : TZ });
};
exports.bulanTahun = (d) => {
  if (!d) return '-';
  const dt = new Date(String(d).slice(0, 7) + '-01T00:00:00Z');
  return dt.toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
exports.todayStr = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
exports.todayLong = () =>
  new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: TZ });

const BADGES = {
  Aktif: 'green', Nonaktif: 'gray', Lunas: 'green', 'Belum Bayar': 'red',
  'Menunggu RT': 'orange', 'Diverifikasi RT': 'blue', Selesai: 'green', Ditolak: 'red',
  Diterima: 'blue', 'Dalam Proses': 'orange', Pemasukan: 'green', Pengeluaran: 'red',
};
exports.badge = (s) => BADGES[s] || 'gray';
exports.roleLabel = (r) => ({ rw: 'Ketua / Staff RW', rt: 'Ketua RT', warga: 'Warga' }[r] || r);
