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

function parseAmount(message) {
  const num = message.match(/\d+/);
  if (num) return parseInt(num[0]);
  if (message.includes('בקבוק')) return 500;
  return 200;
}

function addWater(ml) {
  const today = getTodayDate();
  db.prepare('INSERT INTO water (date, ml) VALUES (?, ?)').run(today, ml);
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

module.exports = { addWater, getTodayWater, resetDay, parseAmount };
