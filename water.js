const Database = require('better-sqlite3');
const db = new Database('expenses.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS water (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    ml INTEGER NOT NULL DEFAULT 200
  )
`);

function getTodayDate() {
  return new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Jerusalem'});
}

function addWater() {
  const today = getTodayDate();
  db.prepare('INSERT INTO water (date, ml) VALUES (?, 200)').run(today);
  const total = db.prepare('SELECT SUM(ml) as total FROM water WHERE date = ?').get(today);
  return total.total || 0;
}

function getTodayWater() {
  const today = getTodayDate();
  const total = db.prepare('SELECT SUM(ml) as total FROM water WHERE date = ?').get(today);
  return total.total || 0;
}

function resetDay() {
  const today = getTodayDate();
  db.prepare('DELETE FROM water WHERE date = ?').run(today);
}

module.exports = { addWater, getTodayWater, resetDay };
