const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const finance = require('./finance');
const patrimonio = require('./patrimonio');
const health = require('./health');
const opportunities = require('./opportunities');

// Ferramentas que o agente pode chamar para agir de verdade (nao so conversar).
// Fase 1: rotina/tarefas + memoria de longo prazo. Fase 2a: financas pessoais
// e da empresa. Fase 2b: patrimonio. Fase 2c: saude. Fase 2d: oportunidades
// de negocio/investimento (triagem + analise por raciocinio, sem busca web).

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
    description: 'Cria uma conta financeira (conta corrente, poupança, carteira, cartão etc), pessoal ou da empresa.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome da conta, ex: "Nubank", "Carteira", "Conta PJ"' },
        type: { type: 'string', description: 'Tipo livre, ex: corrente, poupança, carteira, cartão de crédito, investimento' },
        initial_balance: { type: 'number', description: 'Saldo inicial da conta' },
        scope: { type: 'string', enum: ['pessoal', 'empresa'], description: 'Se é uma conta pessoal ou da empresa. Padrão: pessoal.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_finance_accounts',
    description: 'Lista as contas financeiras do usuário com seus saldos atuais.',
    input_schema: {
      type: 'object',
      properties: {
        scope: { type: 'string', enum: ['pessoal', 'empresa'], description: 'Padrão: pessoal.' },
      },
    },
  },
  {
    name: 'log_transaction',
    description: 'Registra uma entrada (receita) ou saída (despesa) financeira, pessoal ou da empresa. Use amount positivo para receita e negativo para despesa.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Descrição da transação, ex: "Supermercado", "Salário", "Pagamento de fornecedor"' },
        amount: { type: 'number', description: 'Valor: positivo = entrada/receita, negativo = saída/despesa' },
        category: { type: 'string', description: 'Categoria livre, ex: mercado, transporte, moradia, lazer, saúde, salário, fornecedor, folha' },
        account_name: { type: 'string', description: 'Nome da conta a debitar/creditar. Se omitido e houver só uma conta no escopo, usa ela.' },
        occurred_at: { type: 'string', description: 'Data/hora em ISO 8601, se não for agora' },
        scope: { type: 'string', enum: ['pessoal', 'empresa'], description: 'Se a transação é pessoal ou da empresa. Padrão: pessoal.' },
      },
      required: ['description', 'amount'],
    },
  },
  {
    name: 'list_transactions',
    description: 'Lista as transações financeiras recentes, pessoais ou da empresa, com filtro opcional por conta e categoria.',
    input_schema: {
      type: 'object',
      properties: {
        account_name: { type: 'string' },
        category: { type: 'string' },
        limit: { type: 'number' },
        scope: { type: 'string', enum: ['pessoal', 'empresa'], description: 'Padrão: pessoal.' },
      },
    },
  },
  {
    name: 'get_finance_summary',
    description: 'Retorna o resumo financeiro (pessoal ou da empresa): saldo total, receitas, despesas e gastos por categoria no período.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month', 'all'], description: 'Período do resumo, padrão "month"' },
        scope: { type: 'string', enum: ['pessoal', 'empresa'], description: 'Padrão: pessoal.' },
      },
    },
  },

  // ─── Patrimônio (Fase 2b) ─────────────────────────────────────────────
  {
    name: 'create_asset',
    description: 'Registra um ativo (imóvel, veículo, investimento etc) ou passivo (dívida, financiamento) no patrimônio do usuário.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nome, ex: "Apartamento", "Financiamento do carro"' },
        type: { type: 'string', description: 'Categoria livre, ex: imóvel, veículo, investimento, dívida, financiamento' },
        kind: { type: 'string', enum: ['ativo', 'passivo'], description: 'ativo = bem que você tem; passivo = dívida que você deve' },
        value: { type: 'number', description: 'Valor atual, sempre positivo' },
      },
      required: ['name', 'kind', 'value'],
    },
  },
  {
    name: 'list_assets',
    description: 'Lista os ativos e passivos do usuário.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_net_worth',
    description: 'Calcula o patrimônio líquido atual: saldo das contas + ativos - passivos.',
    input_schema: { type: 'object', properties: {} },
  },

  // ─── Saúde pessoal (Fase 2d) ──────────────────────────────────────────
  {
    name: 'log_health_metric',
    description: 'Registra uma métrica de saúde do usuário, ex: peso, horas de sono, minutos de treino, pressão arterial, humor.',
    input_schema: {
      type: 'object',
      properties: {
        metric: { type: 'string', description: 'Nome da métrica em snake_case, ex: peso, sono_horas, treino_min, pressao_sistolica, humor' },
        value: { type: 'number', description: 'Valor numérico da métrica' },
        note: { type: 'string', description: 'Observação opcional' },
        logged_at: { type: 'string', description: 'Data/hora em ISO 8601, se não for agora' },
      },
      required: ['metric', 'value'],
    },
  },
  {
    name: 'list_health_metrics',
    description: 'Lista a última leitura registrada de cada métrica de saúde do usuário.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_health_history',
    description: 'Retorna o histórico de uma métrica de saúde específica ao longo do tempo, para ver tendência.',
    input_schema: {
      type: 'object',
      properties: {
        metric: { type: 'string' },
        days: { type: 'number', description: 'Quantos dias para trás, padrão 90' },
      },
      required: ['metric'],
    },
  },

  // ─── Oportunidades de negócio/investimento (Fase 2e) ──────────────────
  {
    name: 'create_opportunity',
    description: 'Registra uma oportunidade de negócio ou investimento para acompanhar e analisar.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Nome curto da oportunidade' },
        description: { type: 'string', description: 'Descrição, contexto, prós e contras' },
        category: { type: 'string', description: 'Categoria livre, ex: negocio, investimento, imovel, acoes, renda_fixa, cripto' },
        estimated_value: { type: 'number', description: 'Valor estimado envolvido (investimento necessário ou retorno esperado), se souber' },
        next_step: { type: 'string', description: 'Próximo passo a dar nessa oportunidade' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_opportunities',
    description: 'Lista as oportunidades de negócio/investimento do usuário, com filtro opcional por status.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['analisando', 'em_andamento', 'aprovada', 'descartada'] },
      },
    },
  },
  {
    name: 'update_opportunity',
    description: 'Atualiza o status, próximo passo ou descrição de uma oportunidade existente.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['analisando', 'em_andamento', 'aprovada', 'descartada'] },
        next_step: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['id'],
    },
  },
];

function execute(userId, name, input) {
  switch (name) {
    case 'create_task': {
      // Alguns modelos chamam a mesma ferramenta duas vezes na mesma resposta
      // (observado com Gemini). Evita duplicar a tarefa se uma idêntica acabou
      // de ser criada agora mesmo.
      const dup = db.prepare(`
        SELECT id FROM tasks
        WHERE user_id = ? AND title = ? AND due_at IS ? AND status = 'pendente'
          AND created_at >= datetime('now', '-2 minutes')
        ORDER BY created_at DESC LIMIT 1
      `).get(userId, input.title, input.due_at || null);
      if (dup) return { id: dup.id, status: 'já existia (duplicata evitada)' };

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
          scope: input.scope || 'pessoal',
        });
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'list_finance_accounts': {
      return finance.listAccounts(userId, input.scope || 'pessoal');
    }

    case 'log_transaction': {
      const scope = input.scope || 'pessoal';
      const accounts = finance.listAccounts(userId, scope);
      let accountId = null;

      if (input.account_name) {
        const match = accounts.find(a => a.name.toLowerCase() === input.account_name.toLowerCase());
        if (!match) return { error: `Conta "${input.account_name}" não encontrada no escopo ${scope}`, accounts: accounts.map(a => a.name) };
        accountId = match.id;
      } else if (accounts.length === 1) {
        accountId = accounts[0].id;
      } else if (accounts.length === 0) {
        return { error: `Nenhuma conta ${scope} cadastrada ainda. Crie uma com create_finance_account antes de registrar transações.` };
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
      const scope = input.scope || 'pessoal';
      const accounts = finance.listAccounts(userId, scope);
      let accountId;
      if (input.account_name) {
        const match = accounts.find(a => a.name.toLowerCase() === input.account_name.toLowerCase());
        if (!match) return { error: `Conta "${input.account_name}" não encontrada no escopo ${scope}` };
        accountId = match.id;
      }
      return finance.listTransactions(userId, { accountId, category: input.category, limit: input.limit, scope });
    }

    case 'get_finance_summary': {
      return finance.summary(userId, { period: input.period || 'month', scope: input.scope || 'pessoal' });
    }

    case 'create_asset': {
      try {
        return patrimonio.createAsset(userId, { name: input.name, type: input.type, kind: input.kind, value: input.value });
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'list_assets': {
      return patrimonio.listAssets(userId);
    }

    case 'get_net_worth': {
      return patrimonio.computeNetWorth(userId);
    }

    case 'log_health_metric': {
      try {
        return health.logMetric(userId, {
          metric: input.metric, value: input.value, note: input.note, logged_at: input.logged_at,
        });
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'list_health_metrics': {
      return health.listMetrics(userId);
    }

    case 'get_health_history': {
      return health.history(userId, input.metric, { days: input.days || 90 });
    }

    case 'create_opportunity': {
      try {
        return opportunities.create(userId, {
          title: input.title, description: input.description, category: input.category,
          estimated_value: input.estimated_value, next_step: input.next_step,
        });
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'list_opportunities': {
      return opportunities.list(userId, { status: input.status });
    }

    case 'update_opportunity': {
      const result = opportunities.update(userId, input.id, {
        status: input.status, next_step: input.next_step, description: input.description,
      });
      if (!result) return { error: 'Oportunidade não encontrada' };
      return result;
    }

    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}

module.exports = { definitions, execute };
