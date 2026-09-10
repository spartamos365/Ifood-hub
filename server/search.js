const { tavily } = require('@tavily/core');

// Busca real na web via Tavily (https://tavily.com), feita pra ser consumida
// por agentes de IA. Tier gratuito: 1000 créditos/mês, sem cartão de crédito.
// Opcional: se TAVILY_API_KEY não estiver definida, a ferramenta search_web
// simplesmente não é oferecida ao agente (ver server/tools.js e agent.js).

const client = process.env.TAVILY_API_KEY ? tavily({ apiKey: process.env.TAVILY_API_KEY }) : null;

function isConfigured() {
  return !!client;
}

async function search(query, { maxResults = 5 } = {}) {
  if (!client) throw new Error('Busca na web não configurada (defina TAVILY_API_KEY no .env)');

  const response = await client.search(query, { maxResults, includeAnswer: true });

  return {
    answer: response.answer || null,
    results: response.results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      publishedDate: r.publishedDate || null,
    })),
  };
}

module.exports = { search, isConfigured };
