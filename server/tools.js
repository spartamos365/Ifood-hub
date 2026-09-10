const { v4: uuidv4 } = require('uuid');
const db = require('./db');

// Ferramentas que o agente pode chamar para agir de verdade (nao so conversar).
// Fase 1: rotina/tarefas + memoria de longo prazo. Financas, saude, patrimonio
// e busca de negocios entram em fases seguintes, plugando novas ferramentas aqui.

const definitions = [
  {
    name: 'create_task',
    description: 'Cria uma tarefa, compromisso ou lembrete na rotina do usuário.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título curto da tarefa' },
        description: { type: 'string', description: 'Detalhes opcionais' },
        category: { type: 'string', description: 'Categoria livre, ex: trabalho, saude, financeiro, pessoal' },
        priority: { type: 'string', enum: ['baixa', 'normal', 'alta'] },
        due_at: { type: 'string', description: 'Data/hora em ISO 8601, se houver prazo' },
        recurring_rule: { type: 'string', description: 'Descrição livre de recorrência, ex: "toda segunda-feira"' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Lista as tarefas do usuário, com filtro opcional por status e categoria.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pendente', 'concluida', 'cancelada', 'todas'] },
        category: { type: 'string' },
      },
    },
  },
  {
    name: 'complete_task',
    description: 'Marca uma tarefa como concluída pelo id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'remember',
    description: 'Salva um fato, preferência ou contexto importante sobre o usuário na memória de longo prazo, para lembrar em conversas futuras.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'O fato a lembrar, em texto direto' },
        category: { type: 'string', description: 'Categoria livre, ex: preferencias, familia, trabalho, saude' },
      },
      required: ['content'],
    },
  },
  {
    name: 'recall',
    description: 'Busca na memória de longo prazo por fatos relevantes já salvos sobre o usuário.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termo de busca' },
        category: { type: 'string' },
      },
      required: ['query'],
    },
  },
];

function execute(userId, name, input) {
  switch (name) {
    case 'create_task': {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO tasks (id, user_id, title, description, category, priority, due_at, recurring_rule)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, userId, input.title, input.description || null,
        input.category || 'geral', input.priority || 'normal',
        input.due_at || null, input.recurring_rule || null,
      );
      return { id, status: 'criada' };
    }

    case 'list_tasks': {
      const status = input.status && input.status !== 'todas' ? input.status : null;
      const rows = status
        ? db.prepare('SELECT * FROM tasks WHERE user_id = ? AND status = ? ORDER BY due_at IS NULL, due_at ASC')
            .all(userId, status)
        : db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY due_at IS NULL, due_at ASC').all(userId);
      const filtered = input.category ? rows.filter(r => r.category === input.category) : rows;
      return filtered;
    }

    case 'complete_task': {
      const result = db.prepare(`
        UPDATE tasks SET status = 'concluida', completed_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(input.id, userId);
      if (result.changes === 0) return { error: 'Tarefa não encontrada' };
      return { status: 'concluida' };
    }

    case 'remember': {
      const id = uuidv4();
      db.prepare('INSERT INTO memory_notes (id, user_id, category, content) VALUES (?, ?, ?, ?)')
        .run(id, userId, input.category || 'geral', input.content);
      return { id, status: 'salvo' };
    }

    case 'recall': {
      const rows = db.prepare(`
        SELECT * FROM memory_notes WHERE user_id = ? AND content LIKE ?
        ORDER BY created_at DESC LIMIT 20
      `).all(userId, `%${input.query}%`);
      return rows;
    }

    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}

module.exports = { definitions, execute };
