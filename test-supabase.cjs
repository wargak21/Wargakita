require("dotenv").config();
const { Client } = require("pg");

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const result = await client.query(
      "SELECT current_database() AS database, NOW() AS server_time"
    );
    console.log("KONEKSI SUPABASE BERHASIL");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("KONEKSI GAGAL:", error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
