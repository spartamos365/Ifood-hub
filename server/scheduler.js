const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { getProvider } = require('./providers');

async function generateBriefing(userId) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const already = db.prepare('SELECT id FROM briefings WHERE user_id = ? AND date = ?').get(userId, todayStr);
  if (already) return;

  const tasks = db.prepare(`
    SELECT title, category, priority, due_at FROM tasks
    WHERE user_id = ? AND status = 'pendente'
      AND (due_at IS NULL OR substr(due_at, 1, 10) = ?)
    ORDER BY due_at IS NULL, due_at ASC
  `).all(userId, todayStr);

  const userName = process.env.USER_NAME || 'você';
  const taskList = tasks.length
    ? tasks.map(t => `- ${t.title}${t.due_at ? ` (às ${t.due_at})` : ''} [${t.priority}]`).join('\n')
    : '(nenhuma tarefa com prazo para hoje)';

  const prompt = `Gere um resumo matinal curto e direto para ${userName}, em português do Brasil, com base nas tarefas de hoje abaixo. Organize por prioridade, sugira uma ordem de execução, e feche com uma frase objetiva de incentivo. No máximo 150 palavras.\n\nTarefas de hoje:\n${taskList}`;

  const text = await getProvider().complete(prompt, { maxTokens: 500 });
  db.prepare('INSERT INTO briefings (id, user_id, date, content) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), userId, todayStr, text);
}

function startScheduler(getUserId) {
  const timezone = process.env.TIMEZONE || 'America/Sao_Paulo';
  // Todo dia às 07:00 no fuso configurado
  cron.schedule('0 7 * * *', () => {
    generateBriefing(getUserId()).catch(err => console.error('Erro ao gerar briefing:', err.message));
  }, { timezone });
}

module.exports = { startScheduler, generateBriefing };
