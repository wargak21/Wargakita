const fs = require("fs");

const file = "server.js";
let s = fs.readFileSync(file, "utf8");

if (!s.includes("mysql2/promise")) {
  console.log("Koneksi MySQL tidak ditemukan. Periksa server.js secara manual.");
  process.exit(1);
}

s = s.replace(
  "const mysql = require('mysql2/promise');",
  "const { Pool } = require('pg');"
);

const poolPattern = /const pool = mysql\.createPool\(\{[\s\S]*?\n\}\);/;

if (!poolPattern.test(s)) {
  console.error("Blok koneksi MySQL tidak cocok. server.js tidak diubah.");
  process.exit(1);
}

s = s.replace(poolPattern, `const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10
});`);

const queryPattern =
  /async function query\(sql, params = \[\]\) \{[\s\S]*?\}/;

if (!queryPattern.test(s)) {
  console.error("Fungsi query tidak ditemukan. server.js tidak diubah.");
  process.exit(1);
}

s = s.replace(queryPattern, `async function query(sql, params = []) {
  let index = 0;
  const pgSql = sql
    .replace(/"([^"]+)"/g, "'$1'")
    .replace(/SUM\\\\(r\\\\.gender='Laki-laki'\\\\)/g,
      "COUNT(*) FILTER (WHERE r.gender='Laki-laki')")
    .replace(/SUM\\\\(r\\\\.gender='Perempuan'\\\\)/g,
      "COUNT(*) FILTER (WHERE r.gender='Perempuan')")
    .replace(/\\\\?/g, () => "$" + (++index));

  const result = await pool.query(pgSql, params);
  return result.rows;
}`);

fs.writeFileSync(file, s, "utf8");
console.log("server.js telah diubah ke koneksi PostgreSQL.");
