const express = require('express');
const finance = require('../finance');

// Factory de rotas de finanças, parametrizada por escopo ('pessoal' ou 'empresa').
// Usada tanto para /api/finance (pessoal) quanto /api/company/finance (empresa),
// já que a lógica é idêntica — só muda de qual "carteira" os dados vêm.
module.exports = function createFinanceRouter(scope) {
  const router = express.Router();

  router.get('/accounts', (req, res) => {
    res.json({ accounts: finance.listAccounts(req.userId, scope) });
  });

  router.post('/accounts', (req, res) => {
    try {
      const account = finance.createAccount(req.userId, { ...req.body, scope });
      res.status(201).json({ account });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch('/accounts/:id', (req, res) => {
    const account = finance.updateAccount(req.userId, req.params.id, req.body || {});
    if (!account) return res.status(404).json({ error: 'Conta não encontrada' });
    res.json({ account });
  });

  router.delete('/accounts/:id', (req, res) => {
    const ok = finance.deleteAccount(req.userId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Conta não encontrada' });
    res.json({ success: true });
  });

  router.get('/transactions', (req, res) => {
    const { accountId, category, limit } = req.query;
    const transactions = finance.listTransactions(req.userId, {
      accountId, category, limit: limit ? Number(limit) : undefined, scope,
    });
    res.json({ transactions });
  });

  router.post('/transactions', (req, res) => {
    try {
      const { account_id, description, amount, category, occurred_at } = req.body || {};
      const transaction = finance.addTransaction(req.userId, {
        account_id, description, amount: Number(amount), category, occurred_at,
      });
      res.status(201).json({ transaction });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/transactions/:id', (req, res) => {
    const ok = finance.deleteTransaction(req.userId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Transação não encontrada' });
    res.json({ success: true });
  });

  router.get('/summary', (req, res) => {
    const period = req.query.period || 'month';
    res.json(finance.summary(req.userId, { period, scope }));
  });

  return router;
};
