const express = require('express');
const health = require('../health');

const router = express.Router();

// GET /api/health/logs?metric=&limit=
router.get('/logs', (req, res) => {
  const { metric, limit } = req.query;
  res.json({ logs: health.listLogs(req.userId, { metric, limit: limit ? Number(limit) : undefined }) });
});

// POST /api/health/logs
router.post('/logs', (req, res) => {
  try {
    const { metric, value, note, logged_at } = req.body || {};
    const log = health.logMetric(req.userId, {
      metric, value: value !== undefined && value !== '' ? Number(value) : null, note, logged_at,
    });
    res.status(201).json({ log });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/health/logs/:id
router.delete('/logs/:id', (req, res) => {
  const ok = health.deleteLog(req.userId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Registro não encontrado' });
  res.json({ success: true });
});

// GET /api/health/metrics — última leitura de cada métrica
router.get('/metrics', (req, res) => {
  res.json({ metrics: health.listMetrics(req.userId) });
});

// GET /api/health/history?metric=peso&days=90
router.get('/history', (req, res) => {
  const { metric } = req.query;
  if (!metric) return res.status(400).json({ error: 'Parâmetro "metric" é obrigatório' });
  const days = req.query.days ? Number(req.query.days) : 90;
  res.json({ history: health.history(req.userId, metric, { days }) });
});

module.exports = router;
