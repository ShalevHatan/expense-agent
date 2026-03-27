const fs = require('fs');
let c = fs.readFileSync('agent.js', 'utf8');

c = c.replace(
  "const { addTask, getPendingTasks, markDone, getTasks, getTodayDate, getTomorrowDate, getDateForDay, deleteTaskByOrder } = require('./tasks');",
  "const { addTask, getPendingTasks, markDone, getTasks, getTodayDate, getTomorrowDate, getDateForDay, deleteTaskByOrder, getWeekAheadTasks } = require('./tasks');"
);

c = c.replace(
  "- SHOW_TASKS: בקשה לראות את רשימת המשימות",
  "- SHOW_TASKS: בקשה לראות את משימות היום בלבד\n- SHOW_WEEK_TASKS: בקשה לראות משימות לשבוע הקרוב או לוז שבועי"
);

const weekBlock = `  if (type === 'SHOW_WEEK_TASKS') {
    const week = getWeekAheadTasks();
    if (week.length === 0) return 'אין משימות לשבוע הקרוב.';
    let text = 'לוז שבועי:\\n';
    week.forEach(day => {
      text += '\\nיום ' + day.dayName + ' (' + day.date + '):\\n';
      day.tasks.forEach(t => {
        const status = t.done ? 'v' : '-';
        text += status + ' ' + t.day_order + '. ' + t.task + '\\n';
      });
    });
    return text.trim();
  }

  if (type === 'SHOW_TASKS') {`;

c = c.replace("  if (type === 'SHOW_TASKS') {", weekBlock);

fs.writeFileSync('agent.js', c);
console.log('done');
