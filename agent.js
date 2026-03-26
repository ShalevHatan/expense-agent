require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { saveExpense, deleteLastExpense, queryExpenses, getWeeklySummary, getMonthlySummary } = require('./database');
const { addTask, getPendingTasks, markDone, getTasks, getTodayDate, getTomorrowDate } = require('./tasks');

const client = new Anthropic();

async function classifyMessage(message) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 50,
    messages: [{
      role: 'user',
      content: 'סווג את ההודעה הבאה לאחת מהקטגוריות:\n- EXPENSE: הוצאה כספית\n- DELETE: מחיקת הוצאה\n- QUERY: שאלה על הוצאות\n- WEEKLY: סיכום שבועי הוצאות\n- MONTHLY: סיכום חודשי הוצאות\n- DONE_TASKS: דיווח על משימות שסיים (מכיל מילים כמו סיימתי/עשיתי/גמרתי או מספרים של משימות)\n- ADD_TASK: הוספת משימה חדשה לרשימה\n- TOMORROW_TASKS: רשימת משימות למחר\n\nהחזר רק את המילה.\n\nהודעה: "' + message + '"'
    }]
  });
  return response.content[0].text.trim();
}

async function parseExpenses(message) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: 'חלץ רשימת הוצאות. החזר תמיד מערך JSON בלבד ללא backticks:\n[{"amount": 50, "category": "אוכל", "note": "קפה"}]\n\nקטגוריות: אוכל, קניות, דלק, בידור, בריאות, תחבורה, אחר\n\nהודעה: "' + message + '"'
    }]
  });
  const clean = response.content[0].text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function answerQuery(message) {
  const today = new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Jerusalem'});
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: 'התאריך היום בישראל הוא ' + today + '.\nכתוב שאילתת SQLite על טבלת expenses (עמודות: id, amount, category, note, date).\nהשתמש ב-SUM(amount) as total כשצריך סכום.\nכשצריך סינון לפי היום השתמש ב: date LIKE \'' + today + '%\'\nהחזר SQL בלבד ללא backticks.\n\nשאלה: "' + message + '"'
    }]
  });
  const sql = response.content[0].text.replace(/```sql|```/g, '').trim();
  const fixedSql = sql.replace(/"/g, "'");
  console.log('SQL:', fixedSql);
  const rows = queryExpenses(fixedSql);
  if (!rows || rows.length === 0) return 'לא נמצאו הוצאות.';
  let text = '';
  rows.forEach(r => {
    Object.keys(r).forEach(k => {
      const val = r[k] !== null ? r[k] : 0;
      text += k + ': ' + val + '\n';
    });
  });
  return text.trim();
}

async function parseTasks(message, date) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: 'חלץ רשימת משימות מהטקסט הבא והוסף טיפ קצר ומועיל לכל משימה.\nהחזר JSON בלבד ללא backticks:\n[{"task": "שם המשימה", "tip": "טיפ קצר"}]\n\nטקסט: "' + message + '"'
    }]
  });
  const clean = response.content[0].text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function parseDoneTasks(message, pendingTasks) {
  const tasksList = pendingTasks.map(t => t.id + ': ' + t.task).join('\n');
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: 'מתוך רשימת המשימות הבאה, זהה אילו משימות הושלמו לפי ההודעה.\nהחזר JSON בלבד עם מערך של מזהי המשימות שהושלמו:\n[1, 3, 5]\n\nרשימת משימות:\n' + tasksList + '\n\nהודעה: "' + message + '"'
    }]
  });
  const clean = response.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function generateWeeklyTaskFeedback() {
  const { getWeekTasks } = require('./tasks');
  const tasks = getWeekTasks();
  if (tasks.length === 0) return null;
  const summary = tasks.map(t => t.date + ': ' + t.task + ' (' + (t.done ? 'הושלם' : 'לא הושלם') + ')').join('\n');
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: 'זה סיכום המשימות של השבוע האחרון:\n' + summary + '\n\nכתוב משוב קצר ומעודד בעברית על ההספקים, עם תובנה אחת מעשית לשבוע הבא.'
    }]
  });
  return response.content[0].text;
}

async function handleMessage(message) {
  const type = await classifyMessage(message);
  console.log('סוג:', type);

  if (type === 'WEEKLY') {
    const rows = getWeeklySummary();
    if (rows.length === 0) return 'אין הוצאות השבוע עדיין.';
    let text = 'סיכום שבועי:\n';
    let total = 0;
    rows.forEach(r => { text += r.category + ': ' + r.total + ' שקל\n'; total += r.total; });
    return text + 'סהכ: ' + total + ' שקל';
  }

  if (type === 'MONTHLY') {
    const rows = getMonthlySummary();
    if (rows.length === 0) return 'אין הוצאות החודש עדיין.';
    let text = 'סיכום חודשי:\n';
    let total = 0;
    rows.forEach(r => { text += r.category + ': ' + r.total + ' שקל\n'; total += r.total; });
    return text + 'סהכ: ' + total + ' שקל';
  }

  if (type === 'DELETE') {
    const deleted = deleteLastExpense();
    return deleted ? 'ההוצאה האחרונה נמחקה.' : 'לא נמצאה הוצאה למחיקה.';
  }

  if (type === 'QUERY') {
    return await answerQuery(message);
  }

  if (type === 'TOMORROW_TASKS') {
    const tomorrow = getTomorrowDate();
    const tasks = await parseTasks(message, tomorrow);
    tasks.forEach(t => addTask(t.task, t.tip, tomorrow));
    let text = 'משימות למחר נשמרו!\n';
    tasks.forEach((t, i) => { text += (i+1) + '. ' + t.task + '\nטיפ: ' + t.tip + '\n'; });
    return text.trim();
  }

  if (type === 'ADD_TASK') {
    const today = getTodayDate();
    const tasks = await parseTasks(message, today);
    tasks.forEach(t => addTask(t.task, t.tip, today));
    let text = 'נוסף לרשימה!\n';
    tasks.forEach(t => { text += t.task + '\nטיפ: ' + t.tip + '\n'; });
    return text.trim();
  }

  if (type === 'DONE_TASKS') {
    const today = getTodayDate();
    const pending = getPendingTasks(today);
    if (pending.length === 0) return 'אין משימות פתוחות להיום.';
    const doneIds = await parseDoneTasks(message, pending);
    markDone(doneIds);
    const remaining = getPendingTasks(today);
    let text = 'מעולה! עדכנתי ' + doneIds.length + ' משימות כהושלמו.\n';
    if (remaining.length > 0) {
      text += 'נותר:\n';
      remaining.forEach((t, i) => { text += (i+1) + '. ' + t.task + '\n'; });
    } else {
      text += 'סיימת את כל המשימות!';
    }
    return text.trim();
  }

  const expenses = await parseExpenses(message);
  let text = 'נשמר!\n';
  let total = 0;
  expenses.forEach(e => {
    saveExpense(e.amount, e.category, e.note);
    text += (e.note || e.category) + ': ' + e.amount + ' שקל\n';
    total += e.amount;
  });
  if (expenses.length > 1) text += 'סהכ: ' + total + ' שקל';
  return text.trim();
}

module.exports = { handleMessage, generateWeeklyTaskFeedback };
