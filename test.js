require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

async function test() {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'אמור שלום בעברית' }]
  });
  console.log(response.content[0].text);
}

test();