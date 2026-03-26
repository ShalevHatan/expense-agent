cat > ~/expense-agent/agent.js << 'ENDOFFILE'
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
      content: `סווג את ההודעה הבאה לאחת מהקטגוריות:
- EXPENSE (הוצאה או כמה הוצאות)
- DELETE (מחיקת הוצאה)
- QUERY (שאלה על הוצאות)
- WEEKLY (סיכום שבועי)
- MONTHLY (סיכום חודשי)

החזר רק את המילה, ללא שום דבר אחר.

הודעה: "${message}"`
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
      content: `חלץ מההודעה רשימת הוצאות. יכולות להיות אחת או יותר.
חשוב מאוד: החזר תמיד מערך JSON, גם אם יש רק הוצאה אחת.
החזר JSON בלבד, ללא טקסט נוסף, ללא backticks, בפורמט הזה:
[{"amount": 50, "category": "אוכל", "note": "קפה"}, {"amount": 200, "category": "דלק", "note": "תדלוק"}]

קטגוריות אפשריות: אוכל, קניות, דלק, בידור, בריאות, תחבורה, אחר

הודעה: "${message}"`
    }]
  });
  const clean = response.content[0].text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function answerQuery(message) {
  const today = new Date().toISOString().split('T')[0];
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `התאריך היום הוא ${today}.
כתוב שאילתת SQLite אחת שעונה על השאלה הבאה על טבלת expenses.
הטבלה מכילה עמודות: id, amount, category, note, date.
החזר רק את שאילתת ה-SQL, ללא שום דבר אחר, ללא backticks.

שאלה: "${message}"`
    }]
  });
  const sql = response.content[0].text.replace(/```sql|```/g, '').trim();
  const rows = queryExpenses(sql);
  if (!rows || rows.length === 0) return 'לא נמצאו הוצאות תואמות.';

  let text = '';
  rows.forEach(r => {
    if (r.total !== undefined) text += `${r.category || 'סה"כ'}: ${r.total} ₪\n`;
    else if (r.amount !== undefined) text += `${r.note || r.category}: ${r.amount} ₪ (${r.date?.split(' ')[0]})\n`;
    else text += JSON.stringify(r) + '\n';
  });
  return text.trim();
}

async function handleMessage(message) {
  const type = await classifyMessage(message);

  if (type === 'WEEKLY') {
    const rows = getWeeklySummary();
    if (rows.length === 0) return 'אין הוצאות השבוע עדיין.';
    let text = 'סיכום שבועי:\n';
    let total = 0;
    rows.forEach(r => { text += `${r.category}: ${r.total} ₪\n`; total += r.total; });
    return text + `סה"כ: ${total} ₪`;
  }

  if (type === 'MONTHLY') {
    const rows = getMonthlySummary();
    if (rows.length === 0) return 'אין הוצאות החודש עדיין.';
    let text = 'סיכום חודשי:\n';
    let total = 0;
    rows.forEach(r => { text += `${r.category}: ${r.total} ₪\n`; total += r.total; });
    return text + `סה"כ: ${total} ₪`;
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
    text += `${e.note || e.category}: ${e.amount} ₪\n`;
    total += e.amount;
  });
  if (expenses.length > 1) text += `סה"כ: ${total} ₪`;
  return text.trim();
}

module.exports = { handleMessage };
ENDOFFILE