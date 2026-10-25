// Parser CSV sederhana (mendukung tanda kutip, pemisah koma atau titik-koma)
exports.parse = (text) => {
  const rows = [];
  let row = [], cur = '', q = false;
  text = String(text || '').replace(/^\uFEFF/, '');
  const push = () => { row.push(cur); cur = ''; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === ';') push();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      push();
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  push();
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
};

const cell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah CSV/formula injection
  return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
exports.stringify = (header, rows) => '\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
exports.send = (res, name, header, rows) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(exports.stringify(header, rows));
};
