const Database = require('better-sqlite3');
const db = new Database('expenses.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day INTEGER NOT NULL,
    course TEXT NOT NULL,
    type TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
  )
`);

const existing = db.prepare('SELECT COUNT(*) as count FROM schedule').get();
if (existing.count === 0) {
  const insert = db.prepare('INSERT INTO schedule (day, course, type, start_time, end_time) VALUES (?, ?, ?, ?, ?)');
  const classes = [
    [1, 'אלגוריתמים', 'הרצאה', '08:30', '10:20'],
    [1, 'שיטות', 'תרגול', '10:30', '12:20'],
    [1, 'ממשק', 'הרצאה', '12:50', '14:50'],
    [2, 'אלגוריתמים', 'הרצאה', '08:30', '10:20'],
    [2, 'אלגוריתמים', 'תרגול', '10:30', '12:20'],
    [2, 'בדיקות תוכנה', 'מעבדה', '14:50', '16:50'],
    [3, 'שיטות', 'הרצאה', '14:50', '16:40'],
    [4, 'בדיקות תוכנה', 'הרצאה', '08:30', '09:30'],
    [4, 'הסתברות', 'הרצאה', '09:30', '12:20'],
    [4, 'הסתברות', 'תרגול', '13:50', '15:40'],
  ];
  classes.forEach(c => insert.run(...c));
}

function getTodayClasses() {
  const day = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Jerusalem'})).getDay();
  return db.prepare('SELECT * FROM schedule WHERE day = ? ORDER BY start_time').all(day);
}

module.exports = { getTodayClasses };
