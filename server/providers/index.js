// Seleciona o provedor de IA configurado via AI_PROVIDER no .env.
// "groq" (padrão): gratuito, roda na nuvem via Groq.
// "anthropic": pago, melhor qualidade, requer créditos na conta.
function getProvider() {
  const name = (process.env.AI_PROVIDER || 'groq').toLowerCase();
  if (name === 'anthropic') return require('./anthropic');
  if (name === 'groq') return require('./groq');
  throw new Error(`AI_PROVIDER desconhecido: "${name}". Use "groq" ou "anthropic".`);
}

module.exports = { getProvider };
