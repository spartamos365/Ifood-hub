const Anthropic = require('@anthropic-ai/sdk');

// Provedor pago via API da Anthropic (Claude). Melhor qualidade de raciocínio,
// mas exige créditos na conta (console.anthropic.com/settings/billing).

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MAX_TOOL_ROUNDS = 6;

async function runConversation(systemPrompt, history, userMessage, toolDefs, executeTool) {
  const messages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds += 1;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      tools: toolDefs,
      messages,
    });

    if (response.stop_reason !== 'tool_use') {
      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock ? textBlock.text : '';
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      let result;
      try {
        result = await executeTool(block.name, block.input);
      } catch (err) {
        result = { error: err.message };
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return 'Desculpa, precisei de passos demais para responder isso — pode reformular ou dividir o pedido?';
}

async function complete(prompt, { maxTokens = 500 } = {}) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content.find(b => b.type === 'text')?.text || '';
}

module.exports = { runConversation, complete };
