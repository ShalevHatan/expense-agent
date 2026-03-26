require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const cron = require('node-cron');
const { handleMessage } = require('./agent');
const { getWeeklySummary, getMonthlySummary } = require('./database');
const { addWater, getTodayWater, resetDay } = require('./water');

const app = express();
app.use(express.urlencoded({ extended: false }));

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendWhatsApp(message) {
  await twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to: process.env.YOUR_WHATSAPP_NUMBER,
    body: message
  });
}

app.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body.trim();
  const from = req.body.From;

  console.log('הודעה מ-' + from + ': ' + incomingMsg);

  res.sendStatus(200);

  try {
    if (incomingMsg === 'שתיתי') {
      const total = addWater();
      const remaining = 2000 - total;
      let reply = 'שתית ' + total + '/2000 מ״ל';
      if (remaining <= 0) reply += '\nכל הכבוד! הגעת ליעד היומי!';
      else reply += '\nנותרו ' + remaining + ' מ״ל ליעד';
      await sendWhatsApp(reply);
      return;
    }

    const reply = await handleMessage(incomingMsg);
    await sendWhatsApp(reply);
    console.log('תגובה נשלחה: ' + reply);
  } catch (err) {
    console.error('שגיאה:', err.message);
  }
});

async function sendSummary(type) {
  const rows = type === 'weekly' ? getWeeklySummary() : getMonthlySummary();
  const title = type === 'weekly' ? 'סיכום שבועי' : 'סיכום חודשי';
  if (rows.length === 0) return;
  let text = title + ':\n';
  let total = 0;
  rows.forEach(r => { text += r.category + ': ' + r.total + ' שקל\n'; total += r.total; });
  text += 'סהכ: ' + total + ' שקל';
  await sendWhatsApp(text);
}

cron.schedule('0 9 * * 0', () => sendSummary('weekly'), { timezone: 'Asia/Jerusalem' });
cron.schedule('0 9 1 * *', () => sendSummary('monthly'), { timezone: 'Asia/Jerusalem' });

cron.schedule('0 8 * * *', async () => {
  resetDay();
  await sendWhatsApp('תזכורת שתי כוסות מים!');
}, { timezone: 'Asia/Jerusalem' });

cron.schedule('0 12 * * *', async () => {
  await sendWhatsApp('תזכורת שתי כוסות מים!');
}, { timezone: 'Asia/Jerusalem' });

cron.schedule('0 10,14,16,18,20,22 * * *', async () => {
  const total = getTodayWater();
  if (total < 2000) await sendWhatsApp('תזכורת כוס מים!');
}, { timezone: 'Asia/Jerusalem' });

const PORT = 3000;
app.listen(PORT, () => {
  console.log('השרת רץ על פורט ' + PORT);
});
