const express = require('express');
const patrimonio = require('../patrimonio');

const router = express.Router();

// GET /api/patrimonio/assets
router.get('/assets', (req, res) => {
  res.json({ assets: patrimonio.listAssets(req.userId) });
});

// POST /api/patrimonio/assets
router.post('/assets', (req, res) => {
  try {
    const asset = patrimonio.createAsset(req.userId, req.body || {});
    res.status(201).json({ asset });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/patrimonio/assets/:id
router.patch('/assets/:id', (req, res) => {
  const asset = patrimonio.updateAsset(req.userId, req.params.id, req.body || {});
  if (!asset) return res.status(404).json({ error: 'Ativo/passivo não encontrado' });
  res.json({ asset });
});

// DELETE /api/patrimonio/assets/:id
router.delete('/assets/:id', (req, res) => {
  const ok = patrimonio.deleteAsset(req.userId, req.params.id);
  if (!ok) return res.status(404).json({ error: 'Ativo/passivo não encontrado' });
  res.json({ success: true });
});

// GET /api/patrimonio/net-worth — patrimônio líquido atual (cash + ativos - passivos)
router.get('/net-worth', (req, res) => {
  res.json(patrimonio.computeNetWorth(req.userId));
});

// GET /api/patrimonio/history — salva o snapshot de hoje e retorna histórico
router.get('/history', (req, res) => {
  const days = req.query.days ? Number(req.query.days) : 90;
  res.json({ history: patrimonio.snapshotAndHistory(req.userId, { days }) });
});

module.exports = router;
