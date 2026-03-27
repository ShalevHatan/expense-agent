require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { saveExpense, deleteLastExpense, queryExpenses, getWeeklySummary, getMonthlySummary } = require('./database');
const { addTask, getPendingTasks, markDone, getTasks, getTodayDate, getTomorrowDate, getDateForDay, deleteTaskByOrder, getWeekAheadTasks } = require('./tasks');

const client = new Anthropic();

async function classifyMessage(message) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 50,
    messages: [{
      role: 'user',
      content: 'סווג את ההודעה לאחת מהקטגוריות:\n- EXPENSE\n- DELETE_EXPENSE\n- QUERY\n- WEEKLY\n- MONTHLY\n- SHOW_TASKS\n- SHOW_WEEK_TASKS\n- DONE_TASKS\n- DELETE_TASK\n- ADD_TASK\n- TOMORROW_TASKS\n- WEEK_DAY_TASK\n\nכללים:\n- SHOW_WEEK_TASKS: בקשה לוז שבועי או משימות לשבוע\n- SHOW_TASKS: הצג משימות היום\n- WEEK_DAY_TASK: הוספה ליום ספציפי (ראשון/שני וכו)\n- TOMORROW_TASKS: משימות למחר במפורש\n- ADD_TASK: רשימה ממוספרת ללא ציון יום\n- DONE_TASKS: דיווח על ביצוע\n- DELETE_TASK: מחיקה לפי מספר\n- DELETE_EXPENSE: מחיקת הוצאה\n\nהחזר רק את המילה.\n\nהודעה: "' + message + '"'
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

async function parseTasks(message) {
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

async function parseWeekDayTask(message) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: 'חלץ מההודעה את שם היום בשבוע ואת המשימה.\nהחזר JSON בלבד ללא backticks:\n{"day": "שני", "task": "שם המשימה", "tip": "טיפ קצר"}\n\nהודעה: "' + message + '"'
    }]
  });
  const clean = response.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function parseDeleteTask(message) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 50,
    messages: [{
      role: 'user',
      content: 'חלץ את מספר המשימה למחיקה מההודעה. החזר רק את המספר.\n\nהודעה: "' + message + '"'
    }]
  });
  return parseInt(response.content[0].text.trim());
}

async function parseDoneTasks(message, pendingTasks) {
  const tasksList = pendingTasks.map(t => t.day_order + ': ' + t.task).join('\n');
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: 'מתוך רשימת המשימות הבאה, זהה אילו משימות הושלמו לפי ההודעה.\nהחזר JSON בלבד עם מערך של מספרי הסדר:\n[1, 3]\n\nרשימת משימות:\n' + tasksList + '\n\nהודעה: "' + message + '"'
    }]
  });
  const clean = response.content[0].text.replace(/```json|```/g, '').trim();
  const orders = JSON.parse(clean);
  return pendingTasks.filter(t => orders.includes(t.day_order)).map(t => t.id);
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

function formatTasksList(tasks) {
  if (tasks.length === 0) return 'אין משימות.';
  let pending = tasks.filter(t => !t.done);
  let done = tasks.filter(t => t.done);
  let text = '';
  if (pending.length > 0) {
    text += 'משימות פתוחות:\n';
    pending.forEach(t => { text += t.day_order + '. ' + t.task + '\n'; });
  }
  if (done.length > 0) {
    text += '\nהושלמו:\n';
    done.forEach(t => { text += t.day_order + '. ' + t.task + '\n'; });
  }
  return text.trim();
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

  if (type === 'DELETE_EXPENSE') {
    const deleted = deleteLastExpense();
    return deleted ? 'ההוצאה האחרונה נמחקה.' : 'לא נמצאה הוצאה למחיקה.';
  }

  if (type === 'QUERY') {
    return await answerQuery(message);
  }

  if (type === 'SHOW_WEEK_TASKS') {
    const week = getWeekAheadTasks();
    if (week.length === 0) return 'אין משימות לשבוע הקרוב.';
    let text = 'לוז שבועי:\n';
    week.forEach(day => {
      text += '\nיום ' + day.dayName + ' (' + day.date + '):\n';
      day.tasks.forEach(t => {
        const status = t.done ? 'v' : '-';
        text += status + ' ' + t.day_order + '. ' + t.task + '\n';
      });
    });
    return text.trim();
  }

  if (type === 'SHOW_TASKS') {
    const today = getTodayDate();
    const tasks = getTasks(today);
    return formatTasksList(tasks);
  }

  if (type === 'DELETE_TASK') {
    const today = getTodayDate();
    const order = await parseDeleteTask(message);
    const deleted = deleteTaskByOrder(today, order);
    if (!deleted) return 'לא נמצאה משימה מספר ' + order;
    const tasks = getTasks(today);
    let text = 'משימה ' + order + ' בוצעה ונמחקה.\n\n';
    text += formatTasksList(tasks);
    return text.trim();
  }

  if (type === 'TOMORROW_TASKS') {
    const tomorrow = getTomorrowDate();
    const tasks = await parseTasks(message);
    tasks.forEach(t => addTask(t.task, t.tip, tomorrow));
    let text = 'משימות למחר נשמרו!\n';
    const allTasks = getTasks(tomorrow);
    allTasks.forEach(t => { text += t.day_order + '. ' + t.task + '\n'; });
    return text.trim();
  }

  if (type === 'WEEK_DAY_TASK') {
    const parsed = await parseWeekDayTask(message);
    const date = getDateForDay(parsed.day);
    if (!date) return 'לא הבנתי איזה יום.';
    const order = addTask(parsed.task, parsed.tip, date);
    return 'נוסף ליום ' + parsed.day + ' הקרוב!\n' + order + '. ' + parsed.task + '\nטיפ: ' + parsed.tip;
  }

  if (type === 'ADD_TASK') {
    const today = getTodayDate();
    const tasks = await parseTasks(message);
    tasks.forEach(t => addTask(t.task, t.tip, today));
    const allTasks = getTasks(today);
    let text = 'נוסף לרשימה!\n\n';
    text += formatTasksList(allTasks);
    return text.trim();
  }

  if (type === 'DONE_TASKS') {
    const today = getTodayDate();
    const pending = getPendingTasks(today);
    if (pending.length === 0) return 'אין משימות פתוחות להיום.';
    const doneIds = await parseDoneTasks(message, pending);
    markDone(doneIds);
    const allTasks = getTasks(today);
    let text = 'מעולה! עדכנתי ' + doneIds.length + ' משימות.\n\n';
    text += formatTasksList(allTasks);
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
