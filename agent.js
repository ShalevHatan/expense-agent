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
[{"amount": 50, "category": "אוכל"