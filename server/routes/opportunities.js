const express = require('express');
const opportunities = require('../opportunities');

const router = express.Router();

// GET /api/opportunities?status=
router.get('/', (req, res) => {
  res.json({ opportunities: opportunities.list(req.userId, { status: req.query.status }) });
});

// POST /api/opportunities
router.post('/', (req, res) => {
  try {
    const opportunity = opportunities.create(req.userId, req.body || {});
    res.status(201).json({ opportunity });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/opportunities/:id
router.patch('/:id', (req, res) => {
  const opportunity = opportunities.update(req.userId, req.params.id, req.body || {});
  if (!opportunity) return res.status(404).json({ error: 'Oportunidade não encontrada' });
  res.json({ opportunity });
});

// DELETE /api/opportunities/:id
router.delete('/:id', (req, res) => {
  const ok = opportunities.remove(req.userId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Oportunidade não encontrada' });
  res.json({ success: true });
});

module.exports = router;
