const fs = require("fs");

const file = "server.js";
let source = fs.readFileSync(file, "utf8");

const start = source.indexOf("async function query(");
const end = source.indexOf("\nfunction auth", start);

if (start === -1 || end === -1) {
  console.error("Fungsi query tidak ditemukan. File tidak diubah.");
  process.exit(1);
}

const replacement = String.raw`async function query(sql, params = []) {
  let index = 0;
  const pgSql = sql
    .replace(/"([^"]+)"/g, "'$1'")
    .replace(/SUM\(r\.gender='Laki-laki'\)/g,
      "COUNT(*) FILTER (WHERE r.gender='Laki-laki')")
    .replace(/SUM\(r\.gender='Perempuan'\)/g,
      "COUNT(*) FILTER (WHERE r.gender='Perempuan')")
    .replace(/\?/g, () => "$" + (++index));

  const result = await pool.query(pgSql, params);
  return result.rows;
}`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(file, source, "utf8");

console.log("Fungsi query PostgreSQL berhasil diperbaiki.");
