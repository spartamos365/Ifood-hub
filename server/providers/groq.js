const Groq = require('groq-sdk');

// Provedor gratuito via Groq (API na nuvem, sem custo, sem cartão de crédito).
// Groq usa o mesmo formato de tool calling da OpenAI, diferente do formato
// nativo da Anthropic — por isso convertemos as definições de ferramentas.

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MAX_TOOL_ROUNDS = 6;

function toOpenAiTools(toolDefs) {
  return toolDefs.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

async function runConversation(systemPrompt, history, userMessage, toolDefs, executeTool) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds += 1;

    const response = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      messages,
      tools: toOpenAiTools(toolDefs),
    });

    const message = response.choices[0].message;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content || '';
    }

    messages.push({ role: 'assistant', content: message.content, tool_calls: message.tool_calls });

    for (const call of message.tool_calls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        args = {};
      }
      let result;
      try {
        result = executeTool(call.function.name, args);
      } catch (err) {
        result = { error: err.message };
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return 'Desculpa, precisei de passos demais para responder isso — pode reformular ou dividir o pedido?';
}

async function complete(prompt, { maxTokens = 500 } = {}) {
  const response = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0].message.content || '';
}

module.exports = { runConversation, complete };
