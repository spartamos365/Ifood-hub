// Seleciona o provedor de IA configurado via AI_PROVIDER no .env.
// "gemini" (padrão): gratuito, Google Gemini.
// "groq": gratuito, Groq (alternativa, caso o login do Gemini não funcione).
// "anthropic": pago, melhor qualidade, requer créditos na conta.
function getProvider() {
  const name = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  if (name === 'anthropic') return require('./anthropic');
  if (name === 'groq') return require('./groq');
  if (name === 'gemini') return require('./gemini');
  throw new Error(`AI_PROVIDER desconhecido: "${name}". Use "gemini", "groq" ou "anthropic".`);
}

module.exports = { getProvider };
