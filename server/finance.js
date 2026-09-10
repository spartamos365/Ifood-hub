const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// Lógica de finanças pessoais, compartilhada entre as rotas HTTP (routes/finance.js)
// e as ferramentas do agente (tools.js), para não duplicar regras.

function listAccounts(userId, scope = 'pessoal') {
  return db.prepare('SELECT * FROM finance_accounts WHERE user_id = ? AND scope = ? ORDER BY created_at ASC')
    .all(userId, scope);
}

function createAccount(userId, { name, type, initial_balance, scope = 'pessoal' }) {
  if (!name || !name.trim()) throw new Error('Nome da conta é obrigatório');
  const id = uuidv4();
  db.prepare(`
    INSERT INTO finance_accounts (id, user_id, scope, name, type, balance)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, scope, name, type || 'corrente', initial_balance || 0);
  return db.prepare('SELECT * FROM finance_accounts WHERE id = ?').get(id);
}

function updateAccount(userId, id, fields) {
  const account = db.prepare('SELECT * FROM finance_accounts WHERE id = ? AND user_id = ?').get(id, userId);
  if (!account) return null;

  const allowed = ['name', 'type'];
  const updates = [];
  const values = [];
  for (const f of allowed) {
    if (fields[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(fields[f]);
    }
  }
  if (updates.length === 0) return account;

  values.push(id, userId);
  db.prepare(`UPDATE finance_accounts SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  return db.prepare('SELECT * FROM finance_accounts WHERE id = ?').get(id);
}

function deleteAccount(userId, id) {
  const result = db.prepare('DELETE FROM finance_accounts WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}

function addTransaction(userId, { account_id, description, amount, category, occurred_at }) {
  const account = db.prepare('SELECT * FROM finance_accounts WHERE id = ? AND user_id = ?').get(account_id, userId);
  if (!account) throw new Error('Conta não encontrada');
  if (!description || !description.trim()) throw new Error('Descrição é obrigatória');
  if (typeof amount !== 'number' || Number.isNaN(amount) || amount === 0) {
    throw new Error('Valor inválido (use positivo para entrada, negativo para saída)');
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO finance_transactions (id, account_id, description, amount, category, occurred_at)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
  `).run(id, account_id, description, amount, category || 'outros', occurred_at || null);

  db.prepare('UPDATE finance_accounts SET balance = balance + ? WHERE id = ?').run(amount, account_id);

  return db.prepare('SELECT * FROM finance_transactions WHERE id = ?').get(id);
}

function deleteTransaction(userId, transactionId) {
  const row = db.prepare(`
    SELECT ft.* FROM finance_transactions ft
    JOIN finance_accounts fa ON fa.id = ft.account_id
    WHERE ft.id = ? AND fa.user_id = ?
  `).get(transactionId, userId);
  if (!row) return false;

  db.prepare('DELETE FROM finance_transactions WHERE id = ?').run(transactionId);
  db.prepare('UPDATE finance_accounts SET balance = balance - ? WHERE id = ?').run(row.amount, row.account_id);
  return true;
}

function listTransactions(userId, { accountId, category, limit = 100, scope = 'pessoal' } = {}) {
  const clauses = ['fa.user_id = ?', 'fa.scope = ?'];
  const params = [userId, scope];
  if (accountId) { clauses.push('ft.account_id = ?'); params.push(accountId); }
  if (category) { clauses.push('ft.category = ?'); params.push(category); }
  params.push(limit);

  return db.prepare(`
    SELECT ft.*, fa.name as account_name FROM finance_transactions ft
    JOIN finance_accounts fa ON fa.id = ft.account_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY ft.occurred_at DESC LIMIT ?
  `).all(...params);
}

function periodStart(period) {
  switch (period) {
    case 'today': return "datetime('now','start of day')";
    case 'week': return "datetime('now','-7 days')";
    case 'all': return "'0000-01-01'";
    case 'month':
    default: return "datetime('now','start of month')";
  }
}

function summary(userId, { scope = 'pessoal', period = 'month' } = {}) {
  const start = periodStart(period);

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN ft.amount > 0 THEN ft.amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN ft.amount < 0 THEN -ft.amount ELSE 0 END), 0) as expense
    FROM finance_transactions ft
    JOIN finance_accounts fa ON fa.id = ft.account_id
    WHERE fa.user_id = ? AND fa.scope = ? AND ft.occurred_at >= ${start}
  `).get(userId, scope);

  const byCategory = db.prepare(`
    SELECT ft.category, SUM(CASE WHEN ft.amount < 0 THEN -ft.amount ELSE 0 END) as total
    FROM finance_transactions ft
    JOIN finance_accounts fa ON fa.id = ft.account_id
    WHERE fa.user_id = ? AND fa.scope = ? AND ft.occurred_at >= ${start} AND ft.amount < 0
    GROUP BY ft.category ORDER BY total DESC
  `).all(userId, scope);

  const totalBalance = db.prepare(`
    SELECT COALESCE(SUM(balance), 0) as total FROM finance_accounts WHERE user_id = ? AND scope = ?
  `).get(userId, scope);

  return {
    period,
    totalBalance: totalBalance.total,
    income: totals.income,
    expense: totals.expense,
    net: totals.income - totals.expense,
    byCategory,
  };
}

module.exports = {
  listAccounts, createAccount, updateAccount, deleteAccount,
  addTransaction, deleteTransaction, listTransactions, summary,
};
