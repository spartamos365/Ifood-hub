const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// Board de oportunidades de negócio/investimento: o usuário (ou o agente, pela
// conversa) registra e triagem ideias. A análise é feita pelo próprio raciocínio
// do agente na conversa — não há busca ao vivo na web nesta fase.

function list(userId, { status } = {}) {
  return status
    ? db.prepare('SELECT * FROM opportunities WHERE user_id = ? AND status = ? ORDER BY created_at DESC').all(userId, status)
    : db.prepare('SELECT * FROM opportunities WHERE user_id = ? ORDER BY created_at DESC').all(userId);
}

function create(userId, { title, description, category, estimated_value, next_step }) {
  if (!title || !title.trim()) throw new Error('Título é obrigatório');

  // Evita duplicar a oportunidade se o agente chamar a ferramenta duas vezes
  // seguidas para o mesmo pedido do usuário.
  const dup = db.prepare(`
    SELECT * FROM opportunities
    WHERE user_id = ? AND title = ? AND created_at >= datetime('now', '-2 minutes')
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, title);
  if (dup) return dup;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO opportunities (id, user_id, title, description, category, estimated_value, next_step)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, title, description || null, category || 'negocio', estimated_value ?? null, next_step || null);
  return db.prepare('SELECT * FROM opportunities WHERE id = ?').get(id);
}

function update(userId, id, fields) {
  const row = db.prepare('SELECT * FROM opportunities WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) return null;

  const allowed = ['title', 'description', 'category', 'status', 'estimated_value', 'next_step'];
  const updates = [];
  const values = [];
  for (const f of allowed) {
    if (fields[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(fields[f]);
    }
  }
  if (updates.length === 0) return row;
  updates.push("updated_at = datetime('now')");

  values.push(id, userId);
  db.prepare(`UPDATE opportunities SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  return db.prepare('SELECT * FROM opportunities WHERE id = ?').get(id);
}

function remove(userId, id) {
  const result = db.prepare('DELETE FROM opportunities WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

module.exports = { list, create, update, remove };
