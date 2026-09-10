const state = {
  token: localStorage.getItem('token') || null,
  conversationId: localStorage.getItem('conversationId') || null,
};

const els = {
  loginScreen: document.getElementById('login-screen'),
  appScreen: document.getElementById('app-screen'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginError: document.getElementById('login-error'),
  logoutBtn: document.getElementById('logout-btn'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabChat: document.getElementById('tab-chat'),
  tabRoutine: document.getElementById('tab-routine'),
  tabFinance: document.getElementById('tab-finance'),
  tabCompany: document.getElementById('tab-company'),
  tabPatrimonio: document.getElementById('tab-patrimonio'),
  tabHealth: document.getElementById('tab-health'),
  messages: document.getElementById('messages'),
  chatForm: document.getElementById('chat-form'),
  chatText: document.getElementById('chat-text'),
  briefingText: document.getElementById('briefing-text'),
  genBriefingBtn: document.getElementById('gen-briefing-btn'),
  taskList: document.getElementById('task-list'),
  taskForm: document.getElementById('task-form'),
  taskTitle: document.getElementById('task-title'),
  taskDue: document.getElementById('task-due'),
  statBalance: document.getElementById('stat-balance'),
  statIncome: document.getElementById('stat-income'),
  statExpense: document.getElementById('stat-expense'),
  accountList: document.getElementById('account-list'),
  accountForm: document.getElementById('account-form'),
  accountName: document.getElementById('account-name'),
  accountBalance: document.getElementById('account-balance'),
  categoryList: document.getElementById('category-list'),
  transactionList: document.getElementById('transaction-list'),
  transactionForm: document.getElementById('transaction-form'),
  txAccount: document.getElementById('tx-account'),
  txDescription: document.getElementById('tx-description'),
  txAmount: document.getElementById('tx-amount'),
  txType: document.getElementById('tx-type'),
  txCategory: document.getElementById('tx-category'),
  bizStatBalance: document.getElementById('biz-stat-balance'),
  bizStatIncome: document.getElementById('biz-stat-income'),
  bizStatExpense: document.getElementById('biz-stat-expense'),
  bizAccountList: document.getElementById('biz-account-list'),
  bizAccountForm: document.getElementById('biz-account-form'),
  bizAccountName: document.getElementById('biz-account-name'),
  bizAccountBalance: document.getElementById('biz-account-balance'),
  bizCategoryList: document.getElementById('biz-category-list'),
  bizTransactionList: document.getElementById('biz-transaction-list'),
  bizTransactionForm: document.getElementById('biz-transaction-form'),
  bizTxAccount: document.getElementById('biz-tx-account'),
  bizTxDescription: document.getElementById('biz-tx-description'),
  bizTxAmount: document.getElementById('biz-tx-amount'),
  bizTxType: document.getElementById('biz-tx-type'),
  bizTxCategory: document.getElementById('biz-tx-category'),
  statNetworth: document.getElementById('stat-networth'),
  statAssets: document.getElementById('stat-assets'),
  statLiabilities: document.getElementById('stat-liabilities'),
  networthChart: document.getElementById('networth-chart'),
  assetList: document.getElementById('asset-list'),
  assetForm: document.getElementById('asset-form'),
  assetName: document.getElementById('asset-name'),
  assetKind: document.getElementById('asset-kind'),
  assetType: document.getElementById('asset-type'),
  assetValue: document.getElementById('asset-value'),
  metricList: document.getElementById('metric-list'),
  metricSelect: document.getElementById('metric-select'),
  metricChart: document.getElementById('metric-chart'),
  metricForm: document.getElementById('metric-form'),
  metricName: document.getElementById('metric-name'),
  metricValue: document.getElementById('metric-value'),
  metricNote: document.getElementById('metric-note'),
};

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro na requisição');
    return data;
  });
}

function showApp() {
  els.loginScreen.classList.add('hidden');
  els.appScreen.classList.remove('hidden');
  loadConversation();
  loadRoutine();
}

function showLogin() {
  els.appScreen.classList.add('hidden');
  els.loginScreen.classList.remove('hidden');
}

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.loginError.textContent = '';
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: els.loginEmail.value, password: els.loginPassword.value }),
    });
    state.token = data.token;
    localStorage.setItem('token', data.token);
    showApp();
  } catch (err) {
    els.loginError.textContent = err.message;
  }
});

els.logoutBtn.addEventListener('click', () => {
  state.token = null;
  state.conversationId = null;
  localStorage.removeItem('token');
  localStorage.removeItem('conversationId');
  els.messages.innerHTML = '';
  showLogin();
});

els.tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    els.tabBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    els.tabChat.classList.toggle('hidden', tab !== 'chat');
    els.tabRoutine.classList.toggle('hidden', tab !== 'routine');
    els.tabFinance.classList.toggle('hidden', tab !== 'finance');
    els.tabCompany.classList.toggle('hidden', tab !== 'company');
    els.tabPatrimonio.classList.toggle('hidden', tab !== 'patrimonio');
    els.tabHealth.classList.toggle('hidden', tab !== 'health');
    if (tab === 'routine') loadRoutine();
    if (tab === 'finance') personalFinancePanel.load();
    if (tab === 'company') companyFinancePanel.load();
    if (tab === 'patrimonio') loadPatrimonio();
    if (tab === 'health') loadHealth();
  });
});

// ─── Chat ──────────────────────────────────────────────────────────
function addMessage(role, text, pending = false) {
  const div = document.createElement('div');
  div.className = `msg ${role}${pending ? ' pending' : ''}`;
  div.textContent = text;
  els.messages.appendChild(div);
  els.messages.scrollTop = els.messages.scrollHeight;
  return div;
}

async function loadConversation() {
  if (!state.conversationId) return;
  try {
    const data = await api(`/api/chat/${state.conversationId}/messages`);
    els.messages.innerHTML = '';
    data.messages.forEach((m) => addMessage(m.role, m.content));
  } catch {
    // conversa pode ter sido apagada; segue sem histórico
  }
}

els.chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = els.chatText.value.trim();
  if (!text) return;
  els.chatText.value = '';
  addMessage('user', text);
  const pendingEl = addMessage('assistant', 'Pensando...', true);

  try {
    const data = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text, conversationId: state.conversationId }),
    });
    state.conversationId = data.conversationId;
    localStorage.setItem('conversationId', state.conversationId);
    pendingEl.textContent = data.reply;
    pendingEl.classList.remove('pending');
  } catch (err) {
    pendingEl.textContent = `Erro: ${err.message}`;
    pendingEl.classList.remove('pending');
  }
});

// ─── Rotina ────────────────────────────────────────────────────────
async function loadRoutine() {
  try {
    const [briefing, today] = await Promise.all([
      api('/api/routine/briefing/today'),
      api('/api/routine/today'),
    ]);
    els.briefingText.textContent = briefing.briefing
      ? briefing.briefing.content
      : 'Nenhum resumo gerado ainda hoje.';
    renderTasks(today.tasks);
  } catch (err) {
    els.briefingText.textContent = `Erro ao carregar: ${err.message}`;
  }
}

function renderTasks(tasks) {
  els.taskList.innerHTML = '';
  if (!tasks.length) {
    els.taskList.innerHTML = '<li class="task-empty">Nenhuma tarefa para hoje. 🎉</li>';
    return;
  }
  tasks.forEach((task) => {
    const li = document.createElement('li');
    li.className = `task-item priority-${task.priority}${task.status === 'concluida' ? ' done' : ''}`;

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = task.status === 'concluida';
    check.addEventListener('change', async () => {
      await api(`/api/routine/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: check.checked ? 'concluida' : 'pendente' }),
      });
      loadRoutine();
    });

    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;

    li.appendChild(check);
    li.appendChild(title);

    if (task.due_at) {
      const due = document.createElement('span');
      due.className = 'task-due';
      due.textContent = new Date(task.due_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      li.appendChild(due);
    }

    els.taskList.appendChild(li);
  });
}

els.taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = els.taskTitle.value.trim();
  if (!title) return;
  const due_at = els.taskDue.value ? new Date(els.taskDue.value).toISOString() : null;
  await api('/api/routine/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, due_at }),
  });
  els.taskTitle.value = '';
  els.taskDue.value = '';
  loadRoutine();
});

els.genBriefingBtn.addEventListener('click', async () => {
  els.briefingText.textContent = 'Gerando...';
  try {
    const data = await api('/api/routine/briefing/generate', { method: 'POST' });
    els.briefingText.textContent = data.briefing.content;
  } catch (err) {
    els.briefingText.textContent = `Erro: ${err.message}`;
  }
});

// ─── Finanças (pessoal + empresa, mesmo painel reaproveitado) ───────
function formatCurrency(value) {
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderAccountsInto(e, accounts) {
  e.accountList.innerHTML = '';
  e.txAccount.innerHTML = '';

  if (!accounts.length) {
    e.accountList.innerHTML = '<li class="task-empty">Nenhuma conta cadastrada ainda.</li>';
  }

  accounts.forEach((acc) => {
    const li = document.createElement('li');
    li.className = 'account-item';
    li.innerHTML = `<span>${acc.name} <span class="tx-meta">(${acc.type})</span></span>`;
    const balance = document.createElement('span');
    balance.className = acc.balance >= 0 ? 'amount-positive' : 'amount-negative';
    balance.textContent = formatCurrency(acc.balance);
    li.appendChild(balance);
    e.accountList.appendChild(li);

    const option = document.createElement('option');
    option.value = acc.name;
    option.textContent = acc.name;
    e.txAccount.appendChild(option);
  });
}

function renderCategoriesInto(e, categories) {
  e.categoryList.innerHTML = '';
  if (!categories.length) {
    e.categoryList.innerHTML = '<li class="task-empty">Nenhum gasto registrado este mês.</li>';
    return;
  }
  categories.forEach((c) => {
    const li = document.createElement('li');
    li.className = 'category-item';
    li.innerHTML = `<span>${c.category}</span>`;
    const total = document.createElement('span');
    total.className = 'amount-negative';
    total.textContent = formatCurrency(c.total);
    li.appendChild(total);
    e.categoryList.appendChild(li);
  });
}

function renderTransactionsInto(e, transactions) {
  e.transactionList.innerHTML = '';
  if (!transactions.length) {
    e.transactionList.innerHTML = '<li class="task-empty">Nenhuma transação ainda.</li>';
    return;
  }
  transactions.forEach((tx) => {
    const li = document.createElement('li');
    li.className = 'transaction-item';

    const info = document.createElement('div');
    info.className = 'tx-info';
    const title = document.createElement('span');
    title.textContent = tx.description;
    const meta = document.createElement('span');
    meta.className = 'tx-meta';
    meta.textContent = `${tx.account_name} · ${tx.category} · ${new Date(tx.occurred_at).toLocaleDateString('pt-BR')}`;
    info.appendChild(title);
    info.appendChild(meta);

    const amount = document.createElement('span');
    amount.className = tx.amount >= 0 ? 'amount-positive' : 'amount-negative';
    amount.textContent = formatCurrency(tx.amount);

    li.appendChild(info);
    li.appendChild(amount);
    e.transactionList.appendChild(li);
  });
}

// Cria um painel de finanças completo (carregamento + formulários) ligado
// a um prefixo de API ('/api/finance' ou '/api/company/finance') e a um
// conjunto de elementos DOM. Usado para as abas "Finanças" e "Empresa".
function createFinancePanel(apiPrefix, e) {
  async function load() {
    try {
      const [summary, accounts, transactions] = await Promise.all([
        api(`${apiPrefix}/summary?period=month`),
        api(`${apiPrefix}/accounts`),
        api(`${apiPrefix}/transactions?limit=20`),
      ]);
      e.statBalance.textContent = formatCurrency(summary.totalBalance);
      e.statIncome.textContent = formatCurrency(summary.income);
      e.statExpense.textContent = formatCurrency(summary.expense);

      renderAccountsInto(e, accounts.accounts);
      renderCategoriesInto(e, summary.byCategory);
      renderTransactionsInto(e, transactions.transactions);
    } catch (err) {
      e.statBalance.textContent = `Erro: ${err.message}`;
    }
  }

  e.accountForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = e.accountName.value.trim();
    if (!name) return;
    await api(`${apiPrefix}/accounts`, {
      method: 'POST',
      body: JSON.stringify({ name, initial_balance: Number(e.accountBalance.value) || 0 }),
    });
    e.accountName.value = '';
    e.accountBalance.value = '';
    load();
  });

  e.transactionForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const accountName = e.txAccount.value;
    if (!accountName) {
      alert('Cadastre uma conta primeiro.');
      return;
    }
    const accounts = await api(`${apiPrefix}/accounts`);
    const account = accounts.accounts.find((a) => a.name === accountName);
    const rawAmount = Math.abs(Number(e.txAmount.value));
    const amount = e.txType.value === 'despesa' ? -rawAmount : rawAmount;

    await api(`${apiPrefix}/transactions`, {
      method: 'POST',
      body: JSON.stringify({
        account_id: account.id,
        description: e.txDescription.value.trim(),
        amount,
        category: e.txCategory.value.trim() || 'outros',
      }),
    });

    e.txDescription.value = '';
    e.txAmount.value = '';
    e.txCategory.value = '';
    load();
  });

  return { load };
}

const personalFinancePanel = createFinancePanel('/api/finance', {
  statBalance: els.statBalance, statIncome: els.statIncome, statExpense: els.statExpense,
  accountList: els.accountList, accountForm: els.accountForm,
  accountName: els.accountName, accountBalance: els.accountBalance,
  categoryList: els.categoryList, transactionList: els.transactionList,
  transactionForm: els.transactionForm, txAccount: els.txAccount,
  txDescription: els.txDescription, txAmount: els.txAmount,
  txType: els.txType, txCategory: els.txCategory,
});

const companyFinancePanel = createFinancePanel('/api/company/finance', {
  statBalance: els.bizStatBalance, statIncome: els.bizStatIncome, statExpense: els.bizStatExpense,
  accountList: els.bizAccountList, accountForm: els.bizAccountForm,
  accountName: els.bizAccountName, accountBalance: els.bizAccountBalance,
  categoryList: els.bizCategoryList, transactionList: els.bizTransactionList,
  transactionForm: els.bizTransactionForm, txAccount: els.bizTxAccount,
  txDescription: els.bizTxDescription, txAmount: els.bizTxAmount,
  txType: els.bizTxType, txCategory: els.bizTxCategory,
});

// ─── Patrimônio ────────────────────────────────────────────────────
async function loadPatrimonio() {
  try {
    const [netWorth, assets, history] = await Promise.all([
      api('/api/patrimonio/net-worth'),
      api('/api/patrimonio/assets'),
      api('/api/patrimonio/history?days=90'),
    ]);
    els.statNetworth.textContent = formatCurrency(netWorth.netWorth);
    els.statAssets.textContent = formatCurrency(netWorth.cash + netWorth.assets);
    els.statLiabilities.textContent = formatCurrency(netWorth.liabilities);

    renderAssets(assets.assets);
    renderSparkline(els.networthChart, history.history, 'total');
  } catch (err) {
    els.statNetworth.textContent = `Erro: ${err.message}`;
  }
}

function renderAssets(assets) {
  els.assetList.innerHTML = '';
  if (!assets.length) {
    els.assetList.innerHTML = '<li class="task-empty">Nenhum ativo ou passivo cadastrado ainda.</li>';
    return;
  }
  assets.forEach((a) => {
    const li = document.createElement('li');
    li.className = 'account-item';
    li.innerHTML = `<span>${a.name} <span class="tx-meta">(${a.type})</span></span>`;
    const value = document.createElement('span');
    value.className = a.kind === 'passivo' ? 'amount-negative' : 'amount-positive';
    value.textContent = formatCurrency(a.kind === 'passivo' ? -a.value : a.value);
    li.appendChild(value);
    els.assetList.appendChild(li);
  });
}

// Sparkline genérico em SVG, reaproveitado pelo gráfico de patrimônio e pelo de saúde.
function renderSparkline(svg, points, valueKey) {
  svg.innerHTML = '';
  if (points.length < 2) return;

  const values = points.map((p) => p[valueKey]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 300, h = 80, pad = 6;

  const coords = points.map((pt, i) => {
    const x = (i / (points.length - 1)) * (w - pad * 2) + pad;
    const y = h - pad - ((pt[valueKey] - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', coords);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke-width', '2');
  polyline.setAttribute('style', 'stroke: var(--accent)');
  svg.appendChild(polyline);
}

els.assetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = els.assetName.value.trim();
  if (!name) return;
  await api('/api/patrimonio/assets', {
    method: 'POST',
    body: JSON.stringify({
      name,
      kind: els.assetKind.value,
      type: els.assetType.value.trim() || 'outro',
      value: Math.abs(Number(els.assetValue.value)) || 0,
    }),
  });
  els.assetName.value = '';
  els.assetType.value = '';
  els.assetValue.value = '';
  loadPatrimonio();
});

// ─── Saúde ─────────────────────────────────────────────────────────
async function loadHealth() {
  try {
    const { metrics } = await api('/api/health/metrics');
    renderMetrics(metrics);
    renderMetricSelect(metrics);
    await loadMetricChart();
  } catch (err) {
    els.metricList.innerHTML = `<li class="task-empty">Erro: ${err.message}</li>`;
  }
}

function renderMetrics(metrics) {
  els.metricList.innerHTML = '';
  if (!metrics.length) {
    els.metricList.innerHTML = '<li class="task-empty">Nenhuma métrica registrada ainda.</li>';
    return;
  }
  metrics.forEach((m) => {
    const li = document.createElement('li');
    li.className = 'account-item';
    li.innerHTML = `<span>${m.metric}${m.note ? ` <span class="tx-meta">(${m.note})</span>` : ''}</span>`;
    const value = document.createElement('span');
    value.className = 'tx-meta';
    value.textContent = `${m.value} · ${new Date(m.logged_at).toLocaleDateString('pt-BR')}`;
    li.appendChild(value);
    els.metricList.appendChild(li);
  });
}

function renderMetricSelect(metrics) {
  const previous = els.metricSelect.value;
  els.metricSelect.innerHTML = '';
  metrics.forEach((m) => {
    const option = document.createElement('option');
    option.value = m.metric;
    option.textContent = m.metric;
    els.metricSelect.appendChild(option);
  });
  if (metrics.some((m) => m.metric === previous)) els.metricSelect.value = previous;
}

async function loadMetricChart() {
  const metric = els.metricSelect.value;
  if (!metric) {
    els.metricChart.innerHTML = '';
    return;
  }
  const { history } = await api(`/api/health/history?metric=${encodeURIComponent(metric)}&days=90`);
  renderSparkline(els.metricChart, history, 'value');
}

els.metricSelect.addEventListener('change', loadMetricChart);

els.metricForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const metric = els.metricName.value.trim();
  if (!metric) return;
  await api('/api/health/logs', {
    method: 'POST',
    body: JSON.stringify({
      metric, value: Number(els.metricValue.value), note: els.metricNote.value.trim() || undefined,
    }),
  });
  els.metricName.value = '';
  els.metricValue.value = '';
  els.metricNote.value = '';
  loadHealth();
});

// ─── Boot ──────────────────────────────────────────────────────────
if (state.token) {
  showApp();
} else {
  showLogin();
}
