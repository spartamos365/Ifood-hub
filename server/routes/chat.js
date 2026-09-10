const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { runAgent } = require('../agent');

const router = express.Router();

function getOrCreateConversation(userId, conversationId) {
  if (conversationId) {
    const existing = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
      .get(conversationId, userId);
    if (existing) return existing;
  }
  const id = uuidv4();
  db.prepare('INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)')
    .run(id, userId, null);
  return { id, user_id: userId };
}

// GET /api/chat/conversations — lista conversas recentes
router.get('/conversations', (req, res) => {
  const rows = db.prepare(`
    SELECT id, title, created_at FROM conversations
    WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(req.userId);
  res.json({ conversations: rows });
});

// GET /api/chat/:conversationId/messages — histórico de uma conversa
router.get('/:conversationId/messages', (req, res) => {
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.conversationId, req.userId);
  if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada' });

  const rows = db.prepare(`
    SELECT role, content, created_at FROM messages
    WHERE conversation_id = ? ORDER BY created_at ASC
  `).all(conversation.id);
  res.json({ messages: rows });
});

// POST /api/chat — envia uma mensagem para o agente
router.post('/', async (req, res) => {
  const { message, conversationId } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Mensagem vazia' });
  }

  try {
    const conversation = getOrCreateConversation(req.userId, conversationId);

    const history = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 40
    `).all(conversation.id);

    const reply = await runAgent(req.userId, history, message);

    const now = new Date().toISOString();
    db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), conversation.id, 'user', message);
    db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), conversation.id, 'assistant', reply);

    if (!conversation.title) {
      const title = message.slice(0, 60);
      db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, conversation.id);
    }

    res.json({ conversationId: conversation.id, reply, timestamp: now });
  } catch (err) {
    req.log.error('Erro no chat: ' + err.message);
    res.status(500).json({ error: 'Falha ao falar com o assistente. Verifique a chave de API do provedor configurado (AI_PROVIDER) no .env.' });
  }
});

module.exports = router;
