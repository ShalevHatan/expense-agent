const Database = require('better-sqlite3');
const db = new Database('expenses.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    task TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    tip TEXT,
    day_order INTEGER DEFAULT 0
  )
`);

try { db.exec('ALTER TABLE tasks ADD COLUMN day_order INTEGER DEFAULT 0'); } catch(e) {}

function getTodayDate() {
  return new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Jerusalem'});
}

function getTomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA', {timeZone: 'Asia/Jerusalem'});
}

function getDateForDay(dayName) {
  const days = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 };
  const today = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Jerusalem'}));
  const todayDay = today.getDay();
  const targetDay = days[dayName];
  if (targetDay === undefined) return null;
  let diff = targetDay - todayDay;
  if (diff <= 0) diff += 7;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target.toLocaleDateString('en-CA', {timeZone: 'Asia/Jerusalem'});
}

function getNextOrder(date) {
  const last = db.prepare('SELECT MAX(day_order) as max FROM tasks WHERE date = ?').get(date);
  return (last.max || 0) + 1;
}

function addTask(task, tip, date) {
  const order = getNextOrder(date);
  db.prepare('INSERT INTO tasks (date, task, tip, day_order) VALUES (?, ?, ?, ?)').run(date, task, tip, order);
  return order;
}

function getTasks(date) {
  return db.prepare('SELECT * FROM tasks WHERE date = ? ORDER BY day_order').all(date);
}

function getPendingTasks(date) {
  return db.prepare('SELECT * FROM tasks WHERE date = ? AND done = 0 ORDER BY day_order').all(date);
}

function markDone(taskIds) {
  const stmt = db.prepare('UPDATE tasks SET done = 1 WHERE id = ?');
  taskIds.forEach(id => stmt.run(id));
}

function deleteTaskByOrder(date, order) {
  const task = db.prepare('SELECT * FROM tasks WHERE date = ? AND day_order = ?').get(date, order);
  if (!task) return null;
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  return task;
}

function getWeekTasks() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const weekAgo = d.toLocaleDateString('en-CA', {timeZone: 'Asia/Jerusalem'});
  return db.prepare('SELECT * FROM tasks WHERE date >= ? ORDER BY date, day_order').all(weekAgo);
}

module.exports = { addTask, getTasks, getPendingTasks, markDone, deleteTaskByOrder, getWeekTasks, getTodayDate, getTomorrowDate, getDateForDay };
