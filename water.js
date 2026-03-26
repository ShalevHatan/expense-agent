const messages = [
  'שתה מים',
  'זמן לכוס מים',
  'אל תשכח לשתות',
  'מים = אנרגיה',
  'כוס מים קטנה?',
  'גוף שמח = גוף שתוי'
];

function getWaterMessage() {
  const i = Math.floor(Math.random() * messages.length);
  return messages[i];
}

module.exports = { getWaterMessage };
