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
  tabPatrimonio: document.getElementById('tab-patrimonio'),
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
    els.tabPatrimonio.classList.toggle('hidden', tab !== 'patrimonio');
    if (tab === 'routine') loadRoutine();
    if (tab === 'finance') loadFinance();
    if (tab === 'patrimonio') loadPatrimonio();
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

// ─── Finanças ──────────────────────────────────────────────────────
function formatCurrency(value) {
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function loadFinance() {
  try {
    const [summary, accounts, transactions] = await Promise.all([
      api('/api/finance/summary?period=month'),
      api('/api/finance/accounts'),
      api('/api/finance/transactions?limit=20'),
    ]);
    els.statBalance.textContent = formatCurrency(summary.totalBalance);
    els.statIncome.textContent = formatCurrency(summary.income);
    els.statExpense.textContent = formatCurrency(summary.expense);

    renderAccounts(accounts.accounts);
    renderCategories(summary.byCategory);
    renderTransactions(transactions.transactions);
  } catch (err) {
    els.statBalance.textContent = `Erro: ${err.message}`;
  }
}

function renderAccounts(accounts) {
  els.accountList.innerHTML = '';
  els.txAccount.innerHTML = '';

  if (!accounts.length) {
    els.accountList.innerHTML = '<li class="task-empty">Nenhuma conta cadastrada ainda.</li>';
  }

  accounts.forEach((acc) => {
    const li = document.createElement('li');
    li.className = 'account-item';
    li.innerHTML = `<span>${acc.name} <span class="tx-meta">(${acc.type})</span></span>`;
    const balance = document.createElement('span');
    balance.className = acc.balance >= 0 ? 'amount-positive' : 'amount-negative';
    balance.textContent = formatCurrency(acc.balance);
    li.appendChild(balance);
    els.accountList.appendChild(li);

    const option = document.createElement('option');
    option.value = acc.name;
    option.textContent = acc.name;
    els.txAccount.appendChild(option);
  });
}

function renderCategories(categories) {
  els.categoryList.innerHTML = '';
  if (!categories.length) {
    els.categoryList.innerHTML = '<li class="task-empty">Nenhum gasto registrado este mês.</li>';
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
    els.categoryList.appendChild(li);
  });
}

function renderTransactions(transactions) {
  els.transactionList.innerHTML = '';
  if (!transactions.length) {
    els.transactionList.innerHTML = '<li class="task-empty">Nenhuma transação ainda.</li>';
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
    els.transactionList.appendChild(li);
  });
}

els.accountForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = els.accountName.value.trim();
  if (!name) return;
  await api('/api/finance/accounts', {
    method: 'POST',
    body: JSON.stringify({ name, initial_balance: Number(els.accountBalance.value) || 0 }),
  });
  els.accountName.value = '';
  els.accountBalance.value = '';
  loadFinance();
});

els.transactionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const accountName = els.txAccount.value;
  if (!accountName) {
    alert('Cadastre uma conta primeiro.');
    return;
  }
  const accounts = await api('/api/finance/accounts');
  const account = accounts.accounts.find((a) => a.name === accountName);
  const rawAmount = Math.abs(Number(els.txAmount.value));
  const amount = els.txType.value === 'despesa' ? -rawAmount : rawAmount;

  await api('/api/finance/transactions', {
    method: 'POST',
    body: JSON.stringify({
      account_id: account.id,
      description: els.txDescription.value.trim(),
      amount,
      category: els.txCategory.value.trim() || 'outros',
    }),
  });

  els.txDescription.value = '';
  els.txAmount.value = '';
  els.txCategory.value = '';
  loadFinance();
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
    renderNetWorthChart(history.history);
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

function renderNetWorthChart(history) {
  const svg = els.networthChart;
  svg.innerHTML = '';
  if (history.length < 2) return;

  const values = history.map((h) => h.total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 300, h = 80, pad = 6;

  const points = history.map((pt, i) => {
    const x = (i / (history.length - 1)) * (w - pad * 2) + pad;
    const y = h - pad - ((pt.total - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', points);
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

// ─── Boot ──────────────────────────────────────────────────────────
if (state.token) {
  showApp();
} else {
  showLogin();
}
