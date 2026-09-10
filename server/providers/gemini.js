const { GoogleGenAI } = require('@google/genai');

// Provedor gratuito via Google Gemini (API na nuvem, sem custo, tier gratuito
// generoso). Formato de tool calling próprio do Gemini, diferente do da
// Anthropic e do estilo OpenAI usado pelo Groq.

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const MAX_TOOL_ROUNDS = 6;

function toGeminiTools(toolDefs) {
  return [{
    functionDeclarations: toolDefs.map(t => ({
      name: t.name,
      description: t.description,
      parametersJsonSchema: t.input_schema,
    })),
  }];
}

async function runConversation(systemPrompt, history, userMessage, toolDefs, executeTool) {
  const contents = [
    ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds += 1;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools: toGeminiTools(toolDefs),
        maxOutputTokens: 2048,
      },
    });

    const calls = response.functionCalls;
    if (!calls || calls.length === 0) {
      return response.text || '';
    }

    // Reenvia as partes originais da resposta do modelo (não reconstruídas),
    // porque cada parte de function call carrega um "thoughtSignature" que a
    // API exige de volta para o tool calling funcionar corretamente.
    const modelParts = response.candidates[0].content.parts;
    contents.push({ role: 'model', parts: modelParts });

    const responseParts = [];
    for (const c of calls) {
      let result;
      try {
        result = await executeTool(c.name, c.args || {});
      } catch (err) {
        result = { error: err.message };
      }
      responseParts.push({ functionResponse: { id: c.id, name: c.name, response: { result } } });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  return 'Desculpa, precisei de passos demais para responder isso — pode reformular ou dividir o pedido?';
}

async function complete(prompt, { maxTokens = 500 } = {}) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { maxOutputTokens: maxTokens },
  });
  return response.text || '';
}

module.exports = { runConversation, complete };
