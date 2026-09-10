const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// GET /api/routine/tasks — lista tarefas (?status=pendente|concluida|cancelada|todas)
router.get('/tasks', (req, res) => {
  const status = req.query.status && req.query.status !== 'todas' ? req.query.status : null;
  const rows = status
    ? db.prepare('SELECT * FROM tasks WHERE user_id = ? AND status = ? ORDER BY due_at IS NULL, due_at ASC')
        .all(req.userId, status)
    : db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY due_at IS NULL, due_at ASC').all(req.userId);
  res.json({ tasks: rows });
});

// GET /api/routine/today — agenda de hoje (pendentes com due_at hoje + sem prazo)
router.get('/today', (req, res) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT * FROM tasks
    WHERE user_id = ? AND status = 'pendente'
      AND (due_at IS NULL OR substr(due_at, 1, 10) = ?)
    ORDER BY due_at IS NULL, due_at ASC
  `).all(req.userId, todayStr);
  res.json({ tasks: rows });
});

// POST /api/routine/tasks — cria tarefa manualmente
router.post('/tasks', (req, res) => {
  const { title, description, category, priority, due_at, recurring_rule } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Título é obrigatório' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO tasks (id, user_id, title, description, category, priority, due_at, recurring_rule)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.userId, title, description || null, category || 'geral', priority || 'normal', due_at || null, recurring_rule || null);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json({ task });
});

// PATCH /api/routine/tasks/:id — atualiza status/campos de uma tarefa
router.patch('/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: 'Tarefa não encontrada' });

  const fields = ['title', 'description', 'category', 'priority', 'due_at', 'recurring_rule', 'status'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (req.body.status === 'concluida') {
    updates.push("completed_at = datetime('now')");
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Nada para atualizar' });

  values.push(req.params.id, req.userId);
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  res.json({ task: updated });
});

// DELETE /api/routine/tasks/:id
router.delete('/tasks/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
  res.json({ success: true });
});

// GET /api/routine/briefing/today — resumo matinal do dia (se já foi gerado)
router.get('/briefing/today', (req, res) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const row = db.prepare('SELECT * FROM briefings WHERE user_id = ? AND date = ?').get(req.userId, todayStr);
  res.json({ briefing: row || null });
});

// GET /api/routine/memory — lista as anotações de memória de longo prazo
router.get('/memory', (req, res) => {
  const rows = db.prepare('SELECT * FROM memory_notes WHERE user_id = ? ORDER BY created_at DESC LIMIT 200')
    .all(req.userId);
  res.json({ notes: rows });
});

module.exports = router;
