require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const cron = require('node-cron');
const { handleMessage } = require('./agent');
const { getWeeklySummary, getMonthlySummary } = require('./database');

const app = express();
app.use(express.urlencoded({ extended: false }));

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body;
  const from = req.body.From;

  console.log(`הודעה מ-${from}: ${incomingMsg}`);

  try {
    const reply = await handleMessage(incomingMsg);

    await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: from,
      body: reply
    });

    console.log(`תגובה נשלחה: ${reply}`);
  } catch (err) {
    console.error('שגיאה:', err.message);
  }

  res.sendStatus(200);
});

async function sendSummary(type) {
  const rows = type === 'weekly' ? getWeeklySummary() : getMonthlySummary();
  const title = type === 'weekly' ? 'סיכום שבועי' : 'סיכום חודשי';

  if (rows.length === 0) return;

  let text = `${title}:\n`;
  let total = 0;
  rows.forEach(r => {
    text += `${r.category}: ${r.total} ₪\n`;
    total += r.total;
  });
  text += `סה"כ: ${total} ₪`;

  await twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to: process.env.YOUR_WHATSAPP_NUMBER,
    body: text
  });
}

cron.schedule('0 9 * * 0', () => sendSummary('weekly'));
cron.schedule('0 9 1 * *', () => sendSummary('monthly'));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`השרת רץ על פורט ${PORT}`);
});