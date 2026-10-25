// Entry point lokal: `npm start` / `npm run dev`. Di Vercel dipakai api/index.js
const app = require('./src/app');
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`WargaKita berjalan di http://localhost:${PORT}`));
}
module.exports = app;
