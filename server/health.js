const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// Lógica de saúde pessoal, compartilhada entre rotas HTTP e ferramentas do agente.
// Métricas são livres (ex: "peso", "sono_horas", "treino_min", "pressao_sistolica"),
// cada registro é um ponto no tempo com valor numérico opcional e nota livre.

function logMetric(userId, { metric, value, note, logged_at }) {
  if (!metric || !metric.trim()) throw new Error('Métrica é obrigatória');

  // Evita duplicar o registro se o agente chamar a ferramenta duas vezes
  // seguidas para o mesmo pedido do usuário.
  const dup = db.prepare(`
    SELECT * FROM health_logs
    WHERE user_id = ? AND metric = ? AND value IS ?
      AND logged_at >= datetime('now', '-2 minutes')
    ORDER BY logged_at DESC LIMIT 1
  `).get(userId, metric, value ?? null);
  if (dup) return dup;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO health_logs (id, user_id, metric, value, note, logged_at)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
  `).run(id, userId, metric, value ?? null, note || null, logged_at || null);
  return db.prepare('SELECT * FROM health_logs WHERE id = ?').get(id);
}

function listLogs(userId, { metric, limit = 50 } = {}) {
  return metric
    ? db.prepare('SELECT * FROM health_logs WHERE user_id = ? AND metric = ? ORDER BY logged_at DESC LIMIT ?')
        .all(userId, metric, limit)
    : db.prepare('SELECT * FROM health_logs WHERE user_id = ? ORDER BY logged_at DESC LIMIT ?')
        .all(userId, limit);
}

function deleteLog(userId, id) {
  const result = db.prepare('DELETE FROM health_logs WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

// Última leitura de cada métrica já registrada pelo usuário
function listMetrics(userId) {
  const metrics = db.prepare('SELECT DISTINCT metric FROM health_logs WHERE user_id = ? ORDER BY metric')
    .all(userId).map(r => r.metric);

  return metrics.map(metric =>
    db.prepare('SELECT * FROM health_logs WHERE user_id = ? AND metric = ? ORDER BY logged_at DESC LIMIT 1')
      .get(userId, metric)
  );
}

function history(userId, metric, { days = 90 } = {}) {
  return db.prepare(`
    SELECT logged_at, value, note FROM health_logs
    WHERE user_id = ? AND metric = ? AND logged_at >= datetime('now', ?)
    ORDER BY logged_at ASC
  `).all(userId, metric, `-${days} days`);
}

module.exports = { logMetric, listLogs, deleteLog, listMetrics, history };
