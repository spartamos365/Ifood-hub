const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const finance = require('./finance');

// Ferramentas que o agente pode chamar para agir de verdade (nao so conversar).
// Fase 1: rotina/tarefas + memoria de longo prazo. Fase 2a: financas pessoais.
// Saude, patrimonio e busca de negocios entram em fases seguintes, plugando
// novas ferramentas aqui.

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

  // ─── Finanças pessoais (Fase 2a) ─────────────────────────────────────
  {
    name: 'create_finance_account',
    description: 'Cria uma conta financeira pessoal (conta corrente, poupança, carteira, cartão etc).',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome da conta, ex: "Nubank", "Carteira"' },
        type: { type: 'string', description: 'Tipo livre, ex: corrente, poupança, carteira, cartão de crédito, investimento' },
        initial_balance: { type: 'number', description: 'Saldo inicial da conta' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_finance_accounts',
    description: 'Lista as contas financeiras pessoais do usuário com seus saldos atuais.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'log_transaction',
    description: 'Registra uma entrada (receita) ou saída (despesa) financeira. Use amount positivo para receita e negativo para despesa.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Descrição da transação, ex: "Supermercado", "Salário"' },
        amount: { type: 'number', description: 'Valor: positivo = entrada/receita, negativo = saída/despesa' },
        category: { type: 'string', description: 'Categoria livre, ex: mercado, transporte, moradia, lazer, saúde, salário' },
        account_name: { type: 'string', description: 'Nome da conta a debitar/creditar. Se omitido e houver só uma conta, usa ela.' },
        occurred_at: { type: 'string', description: 'Data/hora em ISO 8601, se não for agora' },
      },
      required: ['description', 'amount'],
    },
  },
  {
    name: 'list_transactions',
    description: 'Lista as transações financeiras recentes, com filtro opcional por conta e categoria.',
    input_schema: {
      type: 'object',
      properties: {
        account_name: { type: 'string' },
        category: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_finance_summary',
    description: 'Retorna o resumo financeiro pessoal: saldo total, receitas, despesas e gastos por categoria no período.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month', 'all'], description: 'Período do resumo, padrão "month"' },
      },
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

    case 'create_finance_account': {
      try {
        return finance.createAccount(userId, {
          name: input.name, type: input.type, initial_balance: input.initial_balance,
        });
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'list_finance_accounts': {
      return finance.listAccounts(userId);
    }

    case 'log_transaction': {
      const accounts = finance.listAccounts(userId);
      let accountId = null;

      if (input.account_name) {
        const match = accounts.find(a => a.name.toLowerCase() === input.account_name.toLowerCase());
        if (!match) return { error: `Conta "${input.account_name}" não encontrada`, accounts: accounts.map(a => a.name) };
        accountId = match.id;
      } else if (accounts.length === 1) {
        accountId = accounts[0].id;
      } else if (accounts.length === 0) {
        return { error: 'Nenhuma conta cadastrada ainda. Crie uma com create_finance_account antes de registrar transações.' };
      } else {
        return { error: 'Mais de uma conta encontrada, especifique account_name.', accounts: accounts.map(a => a.name) };
      }

      try {
        return finance.addTransaction(userId, {
          account_id: accountId, description: input.description, amount: input.amount,
          category: input.category, occurred_at: input.occurred_at,
        });
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'list_transactions': {
      const accounts = finance.listAccounts(userId);
      let accountId;
      if (input.account_name) {
        const match = accounts.find(a => a.name.toLowerCase() === input.account_name.toLowerCase());
        if (!match) return { error: `Conta "${input.account_name}" não encontrada` };
        accountId = match.id;
      }
      return finance.listTransactions(userId, { accountId, category: input.category, limit: input.limit });
    }

    case 'get_finance_summary': {
      return finance.summary(userId, { period: input.period || 'month' });
    }

    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}

module.exports = { definitions, execute };
