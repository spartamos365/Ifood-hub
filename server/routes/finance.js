const express = require('express');
const finance = require('../finance');

const router = express.Router();

// GET /api/finance/accounts
router.get('/accounts', (req, res) => {
  res.json({ accounts: finance.listAccounts(req.userId) });
});

// POST /api/finance/accounts
router.post('/accounts', (req, res) => {
  try {
    const account = finance.createAccount(req.userId, req.body || {});
    res.status(201).json({ account });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/finance/accounts/:id
router.patch('/accounts/:id', (req, res) => {
  const account = finance.updateAccount(req.userId, req.params.id, req.body || {});
  if (!account) return res.status(404).json({ error: 'Conta não encontrada' });
  res.json({ account });
});

// DELETE /api/finance/accounts/:id
router.delete('/accounts/:id', (req, res) => {
  const ok = finance.deleteAccount(req.userId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Conta não encontrada' });
  res.json({ success: true });
});

// GET /api/finance/transactions?accountId=&category=&limit=
router.get('/transactions', (req, res) => {
  const { accountId, category, limit } = req.query;
  const transactions = finance.listTransactions(req.userId, {
    accountId, category, limit: limit ? Number(limit) : undefined,
  });
  res.json({ transactions });
});

// POST /api/finance/transactions
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

// DELETE /api/finance/transactions/:id
router.delete('/transactions/:id', (req, res) => {
  const ok = finance.deleteTransaction(req.userId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Transação não encontrada' });
  res.json({ success: true });
});

// GET /api/finance/summary?period=today|week|month|all
router.get('/summary', (req, res) => {
  const period = req.query.period || 'month';
  res.json(finance.summary(req.userId, { period }));
});

module.exports = router;
