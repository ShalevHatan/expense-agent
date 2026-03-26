require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { saveExpense, getWeeklySummary, getMonthlySummary } = require('./database');

const client = new Anthropic();

async function parseExpense(message) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `חלץ מההודעה הבאה: סכום, קטגוריה, והערה.
החזר JSON בלבד, ללא טקסט נוסף, בפורמט הזה:
{"amount": 50, "category": "אוכל", "note": "קפה"}

קטגוריות אפשריות: אוכל, קניות, דלק, בידור, בריאות, תחבורה, אחר

הודעה: "${message}"`
    }]
  });

  const clean = response.content[0].text.replace(/```json|```/g, '').trim();
  const json = JSON.parse(clean);
  return json;
}

async function handleMessage(message) {
  message = message.trim().toLowerCase();

  if (message === 'סיכום שבועי') {
    const rows = getWeeklySummary();
    if (rows.length === 0) return 'אין הוצאות השבוע עדיין.';
    let text = 'סיכום שבועי:\n';
    let total = 0;
    rows.forEach(r => {
      text += `${r.category}: ${r.total} ₪\n`;
      total += r.total;
    });
    text += `סה"כ: ${total} ₪`;
    return text;
  }

  if (message === 'סיכום חודשי') {
    const rows = getMonthlySummary();
    if (rows.length === 0) return 'אין הוצאות החודש עדיין.';
    let text = 'סיכום חודשי:\n';
    let total = 0;
    rows.forEach(r => {
      text += `${r.category}: ${r.total} ₪\n`;
      total += r.total;
    });
    text += `סה"כ: ${total} ₪`;
    return text;
  }

  const expense = await parseExpense(message);
  saveExpense(expense.amount, expense.category, expense.note);
  return `נשמר! ${expense.note || expense.category} — ${expense.amount} ₪`;
}

module.exports = { handleMessage };