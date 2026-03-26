const Database = require('better-sqlite3');
const db = new Database('expenses.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    task TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    tip TEXT
  )
`);

function getTodayDate() {
  return new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Jerusalem'});
}

function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA', {timeZone: 'Asia/Jerusalem'});
}

function saveTasks(tasks, date) {
  const stmt = db.prepare('INSERT INTO tasks (date, task, tip) VALUES (?, ?, ?)');
  tasks.forEach(t => stmt.run(date, t.task, t.tip));
}

function addTask(task, tip, date) {
  db.prepare('INSERT INTO tasks (date, task, tip) VALUES (?, ?, ?)').run(date, task, tip);
}

function getTasks(date) {
  return db.prepare('SELECT * FROM tasks WHERE date = ?').all(date);
}

function getPendingTasks(date) {
  return db.prepare('SELECT * FROM tasks WHERE date = ? AND done = 0').all(date);
}

function markDone(taskIds) {
  const stmt = db.prepare('UPDATE tasks SET done = 1 WHERE id = ?');
  taskIds.forEach(id => stmt.run(id));
}

function getWeekTasks() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const weekAgo = d.toLocaleDateString('en-CA', {timeZone: 'Asia/Jerusalem'});
  return db.prepare('SELECT * FROM tasks WHERE date >= ? ORDER BY date').all(weekAgo);
}

module.exports = { saveTasks, addTask, getTasks, getPendingTasks, markDone, getWeekTasks, getTodayDate, getTomorrowDate };
