const { handleMessage } = require('./agent');

async function test() {
  console.log('בודק הוצאות...\n');

  let res;

  res = await handleMessage('קפה 18 שקל');
  console.log('1:', res);

  res = await handleMessage('מילאתי דלק ב-200');
  console.log('2:', res);

  res = await handleMessage('אוכל במסעדה עם חברים 150 ש"ח');
  console.log('3:', res);

  res = await handleMessage('סיכום שבועי');
  console.log('4:', res);
}

test();