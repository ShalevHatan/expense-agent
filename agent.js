require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { saveExpense, deleteLastExpense, queryExpenses, getWeeklySummary, getMonthlySummary } = require('./database');

const client = new Anthropic();

async function classifyMessage(message) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 50,
    messages: [{
      role: 'user',
      content: 'סווג את ההודעה הבאה לאחת מהקטגוריות:\n- EXPENSE: הוצאה או כמה הוצאות\n- DELETE: מחיקת הוצאה\n- QUERY: שאלה ספציפית על הוצאות לפי תאריך או קטגוריה\n- WEEKLY: בקשה לסיכום שבועי כללי\n- MONTHLY: בקשה לסיכום חודשי כללי\n\nשים לב: "כמה הוצאתי היום" או "כמה הוצאתי על X" זה QUERY ולא WEEKLY.\nהחזר רק את המילה.\n\nהודעה: "' + message + '"'
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
      content: 'התאריך היום בישראל הוא ' + today + '.\nכתוב שאילתת SQLite על טבלת expenses (עמודות: id, amount, category, note, date).\nהשתמש ב-SUM(amount) as total כשצריך סכום.\nכשצריך סינון לפי היום השתמש ב: date LIKE "' + today + '%"\nהחזר SQL בלבד ללא backticks.\n\nשאלה: "' + message + '"'
    }]
  });
  const sql = response.content[0].text.replace(/```sql|```/g, '').trim();
  console.log('SQL:', sql);
  const rows = queryExpenses(sql);
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

module.exports = { handleMessage };
