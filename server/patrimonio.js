const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// Lógica de patrimônio (ativos, passivos e patrimônio líquido), compartilhada
// entre as rotas HTTP e as ferramentas do agente.

function listAssets(userId) {
  return db.prepare('SELECT * FROM assets WHERE user_id = ? ORDER BY kind ASC, value DESC').all(userId);
}

function createAsset(userId, { name, type, kind, value }) {
  if (!name || !name.trim()) throw new Error('Nome do ativo/passivo é obrigatório');
  const resolvedKind = kind === 'passivo' ? 'passivo' : 'ativo';

  // Evita duplicar o ativo/passivo se o agente chamar a ferramenta duas vezes
  // seguidas para o mesmo pedido do usuário.
  const dup = db.prepare(`
    SELECT * FROM assets
    WHERE user_id = ? AND name = ? AND kind = ? AND updated_at >= datetime('now', '-2 minutes')
    ORDER BY updated_at DESC LIMIT 1
  `).get(userId, name, resolvedKind);
  if (dup) return dup;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO assets (id, user_id, name, type, kind, value)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, name, type || 'outro', resolvedKind, value || 0);
  return db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
}

function updateAsset(userId, id, fields) {
  const asset = db.prepare('SELECT * FROM assets WHERE id = ? AND user_id = ?').get(id, userId);
  if (!asset) return null;

  const allowed = ['name', 'type', 'kind', 'value'];
  const updates = [];
  const values = [];
  for (const f of allowed) {
    if (fields[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(fields[f]);
    }
  }
  if (updates.length === 0) return asset;
  updates.push("updated_at = datetime('now')");

  values.push(id, userId);
  db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  return db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
}

function deleteAsset(userId, id) {
  const result = db.prepare('DELETE FROM assets WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

// Patrimônio líquido = saldo das contas pessoais + ativos - passivos
function computeNetWorth(userId) {
  const cash = db.prepare(`
    SELECT COALESCE(SUM(balance), 0) as total FROM finance_accounts
    WHERE user_id = ? AND scope = 'pessoal'
  `).get(userId).total;

  const assetsTotal = db.prepare(`
    SELECT COALESCE(SUM(value), 0) as total FROM assets WHERE user_id = ? AND kind = 'ativo'
  `).get(userId).total;

  const liabilitiesTotal = db.prepare(`
    SELECT COALESCE(SUM(value), 0) as total FROM assets WHERE user_id = ? AND kind = 'passivo'
  `).get(userId).total;

  return {
    cash,
    assets: assetsTotal,
    liabilities: liabilitiesTotal,
    netWorth: cash + assetsTotal - liabilitiesTotal,
  };
}

// Salva o snapshot de hoje (se ainda não existir) e retorna o histórico recente
function snapshotAndHistory(userId, { days = 90 } = {}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const { netWorth } = computeNetWorth(userId);

  db.prepare(`
    INSERT INTO net_worth_snapshots (id, user_id, date, total)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET total = excluded.total
  `).run(uuidv4(), userId, todayStr, netWorth);

  return db.prepare(`
    SELECT date, total FROM net_worth_snapshots
    WHERE user_id = ? AND date >= date('now', ?)
    ORDER BY date ASC
  `).all(userId, `-${days} days`);
}

module.exports = { listAssets, createAsset, updateAsset, deleteAsset, computeNetWorth, snapshotAndHistory };
