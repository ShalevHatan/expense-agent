const Database = require('better-sqlite3');

const db = new Database('expenses.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    note TEXT,
    date TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

function saveExpense(amount, category, note) {
  const stmt = db.prepare(
    'INSERT INTO expenses (amount, category, note) VALUES (?, ?, ?)'
  );
  return stmt.run(amount, category, note);
}

function getWeeklySummary() {
  return db.prepare(`
    SELECT category, SUM(amount) as total
    FROM expenses
    WHERE date >= datetime('now', '-7 days', 'localtime')
    GROUP BY category
    ORDER BY total DESC
  `).all();
}

function getMonthlySummary() {
  return db.prepare(`
    SELECT category, SUM(amount) as total
    FROM expenses
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
    GROUP BY category
    ORDER BY total DESC
  `).all();
}

module.exports = { saveExpense, getWeeklySummary, getMonthlySummary };