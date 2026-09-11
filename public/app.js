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
  tabOpportunities: document.getElementById('tab-opportunities'),
  tabOverview: document.getElementById('tab-overview'),
  overviewGaugeFill: document.getElementById('overview-gauge-fill'),
  overviewGaugeValue: document.getElementById('overview-gauge-value'),
  overviewHeadline: document.getElementById('overview-headline'),
  ovNetworth: document.getElementById('ov-networth'),
  ovPersonalBalance: document.getElementById('ov-personal-balance'),
  ovCompanyBalance: document.getElementById('ov-company-balance'),
  ovOpportunities: document.getElementById('ov-opportunities'),
  overviewNetworthChart: document.getElementById('overview-networth-chart'),
  ovTasks: document.getElementById('ov-tasks'),
  ovHealth: document.getElementById('ov-health'),
  messages: document.getElementById('messages'),
  chatForm: document.getElementById('chat-form'),
  chatText: document.getElementById('chat-text'),
  voiceBtn: document.getElementById('voice-btn'),
  orb: document.getElementById('orb'),
  muteBtn: document.getElementById('mute-btn'),
  attachBtn: document.getElementById('attach-btn'),
  chatImageInput: document.getElementById('chat-image-input'),
  imagePreview: document.getElementById('image-preview'),
  imagePreviewImg: document.getElementById('image-preview-img'),
  imagePreviewRemove: document.getElementById('image-preview-remove'),
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
  importForm: document.getElementById('import-form'),
  importAccount: document.getElementById('import-account'),
  importFile: document.getElementById('import-file'),
  importResult: document.getElementById('import-result'),
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
  bizImportForm: document.getElementById('biz-import-form'),
  bizImportAccount: document.getElementById('biz-import-account'),
  bizImportFile: document.getElementById('biz-import-file'),
  bizImportResult: document.getElementById('biz-import-result'),
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
  opportunityList: document.getElementById('opportunity-list'),
  opportunityForm: document.getElementById('opportunity-form'),
  oppTitle: document.getElementById('opp-title'),
  oppCategory: document.getElementById('opp-category'),
  oppValue: document.getElementById('opp-value'),
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
  loadOverview();
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
    els.tabOverview.classList.toggle('hidden', tab !== 'overview');
    els.tabChat.classList.toggle('hidden', tab !== 'chat');
    els.tabRoutine.classList.toggle('hidden', tab !== 'routine');
    els.tabFinance.classList.toggle('hidden', tab !== 'finance');
    els.tabCompany.classList.toggle('hidden', tab !== 'company');
    els.tabPatrimonio.classList.toggle('hidden', tab !== 'patrimonio');
    els.tabHealth.classList.toggle('hidden', tab !== 'health');
    els.tabOpportunities.classList.toggle('hidden', tab !== 'opportunities');
    if (tab === 'overview') loadOverview();
    if (tab === 'routine') loadRoutine();
    if (tab === 'finance') personalFinancePanel.load();
    if (tab === 'company') companyFinancePanel.load();
    if (tab === 'patrimonio') loadPatrimonio();
    if (tab === 'health') loadHealth();
    if (tab === 'opportunities') loadOpportunities();
  });
});

// ─── Chat ──────────────────────────────────────────────────────────
function addMessage(role, text, pending = false, imageDataUrl = null) {
  const div = document.createElement('div');
  div.className = `msg ${role}${pending ? ' pending' : ''}`;

  if (imageDataUrl) {
    const img = document.createElement('img');
    img.src = imageDataUrl;
    img.className = 'msg-image';
    div.appendChild(img);
  }
  if (text) {
    const textEl = document.createElement('div');
    textEl.textContent = text;
    div.appendChild(textEl);
  }

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

// ─── Anexar foto (ex: recibo) ────────────────────────────────────────
let pendingImageDataUrl = null; // data URL completa, só pra pré-visualização local

function resizeImageFile(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao carregar a imagem'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function clearPendingImage() {
  pendingImageDataUrl = null;
  els.chatImageInput.value = '';
  els.imagePreview.classList.add('hidden');
  els.imagePreviewImg.src = '';
}

els.attachBtn.addEventListener('click', () => els.chatImageInput.click());

els.chatImageInput.addEventListener('change', async () => {
  const file = els.chatImageInput.files[0];
  if (!file) return;
  try {
    pendingImageDataUrl = await resizeImageFile(file);
    els.imagePreviewImg.src = pendingImageDataUrl;
    els.imagePreview.classList.remove('hidden');
  } catch (err) {
    alert(`Não consegui processar essa imagem: ${err.message}`);
    clearPendingImage();
  }
});

els.imagePreviewRemove.addEventListener('click', clearPendingImage);

// ─── Enviar mensagem (texto e/ou imagem) ──────────────────────────────
els.chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = els.chatText.value.trim();
  const imageDataUrl = pendingImageDataUrl;
  if (!text && !imageDataUrl) return;

  let image = null;
  if (imageDataUrl) {
    const [header, data] = imageDataUrl.split(',');
    const mimeType = header.match(/data:(.*);base64/)[1];
    image = { mimeType, data };
  }

  els.chatText.value = '';
  clearPendingImage();
  addMessage('user', text, false, imageDataUrl);
  const pendingEl = addMessage('assistant', 'Pensando...', true);
  setOrbState('thinking');

  try {
    const data = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text, conversationId: state.conversationId, image }),
    });
    state.conversationId = data.conversationId;
    localStorage.setItem('conversationId', state.conversationId);
    pendingEl.textContent = data.reply;
    pendingEl.classList.remove('pending');
    voiceOutput.speak(data.reply);
  } catch (err) {
    pendingEl.textContent = `Erro: ${err.message}`;
    pendingEl.classList.remove('pending');
    setOrbState('idle');
  }
});

// ─── Entrada por voz (opcional) ──────────────────────────────────────
// Requer contexto seguro (HTTPS ou localhost) — o navegador bloqueia o
// microfone em http:// simples, como quando acessado pelo IP da rede local.
// Ver README ("Acessar pelo celular") para expor com HTTPS via Tailscale.
// ─── Orb (avatar animado) + saída por voz (TTS) ───────────────────────
function setOrbState(state) {
  if (!els.orb) return;
  els.orb.classList.remove('idle', 'listening', 'thinking', 'speaking');
  els.orb.classList.add(state);
}

const voiceOutput = (function setupVoiceOutput() {
  let enabled = localStorage.getItem('speechEnabled') !== 'false';
  let ptVoice = null;

  function pickVoice() {
    if (!window.speechSynthesis) return;
    const voices = speechSynthesis.getVoices();
    ptVoice = voices.find(v => v.lang === 'pt-BR') || voices.find(v => (v.lang || '').startsWith('pt')) || null;
  }
  if (window.speechSynthesis) {
    pickVoice();
    speechSynthesis.addEventListener('voiceschanged', pickVoice);
  }

  function updateButtonUI() {
    if (!els.muteBtn) return;
    els.muteBtn.classList.toggle('muted', !enabled);
    const waves = document.getElementById('mute-waves');
    const x = document.getElementById('mute-x');
    if (waves) waves.hidden = !enabled;
    if (x) x.hidden = enabled;
  }

  function speak(text) {
    if (!enabled || !window.speechSynthesis || !text) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    if (ptVoice) utterance.voice = ptVoice;
    utterance.rate = 1.05;
    utterance.onstart = () => setOrbState('speaking');
    utterance.onend = () => setOrbState('idle');
    utterance.onerror = () => setOrbState('idle');
    speechSynthesis.speak(utterance);
  }

  if (els.muteBtn) {
    els.muteBtn.addEventListener('click', () => {
      enabled = !enabled;
      localStorage.setItem('speechEnabled', String(enabled));
      if (!enabled && window.speechSynthesis) speechSynthesis.cancel();
      updateButtonUI();
    });
    updateButtonUI();
  }

  return { speak };
})();

(function setupVoiceInput() {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor || !els.voiceBtn) return;

  const recognition = new SpeechRecognitionCtor();
  recognition.lang = 'pt-BR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let listening = false;

  recognition.addEventListener('start', () => setOrbState('listening'));
  recognition.addEventListener('result', (e) => {
    els.chatText.value = e.results[0][0].transcript;
    els.chatText.focus();
  });
  recognition.addEventListener('end', () => {
    listening = false;
    els.voiceBtn.classList.remove('listening');
    setOrbState('idle');
  });
  recognition.addEventListener('error', () => {
    listening = false;
    els.voiceBtn.classList.remove('listening');
    setOrbState('idle');
  });

  els.voiceBtn.hidden = false;
  els.voiceBtn.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
      return;
    }
    listening = true;
    els.voiceBtn.classList.add('listening');
    recognition.start();
  });
})();

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
    renderTasksInto(els.taskList, today.tasks, loadRoutine);
  } catch (err) {
    els.briefingText.textContent = `Erro ao carregar: ${err.message}`;
  }
}

// Lista de tarefas reaproveitada pela aba Rotina e pela Visão Geral.
function renderTasksInto(listEl, tasks, onToggle) {
  listEl.innerHTML = '';
  if (!tasks.length) {
    listEl.innerHTML = '<li class="task-empty">Nenhuma tarefa para hoje. 🎉</li>';
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
      onToggle();
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

    listEl.appendChild(li);
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
  if (e.importAccount) e.importAccount.innerHTML = '';

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

    if (e.importAccount) {
      const importOption = document.createElement('option');
      importOption.value = acc.id;
      importOption.textContent = acc.name;
      e.importAccount.appendChild(importOption);
    }
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

  if (e.importForm) {
    e.importForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const accountId = e.importAccount.value;
      const file = e.importFile.files[0];
      if (!accountId || !file) {
        e.importResult.textContent = 'Selecione uma conta e um arquivo CSV.';
        return;
      }
      e.importResult.textContent = 'Importando...';
      try {
        const csv = await file.text();
        const result = await api(`${apiPrefix}/accounts/${accountId}/import`, {
          method: 'POST',
          body: JSON.stringify({ csv }),
        });
        const errorNote = result.errors.length ? ` — ${result.errors.slice(0, 3).join('; ')}` : '';
        e.importResult.textContent = `${result.imported} importadas, ${result.skipped} já existiam, ${result.errors.length} com erro${errorNote}`;
        e.importFile.value = '';
        load();
      } catch (err) {
        e.importResult.textContent = `Erro: ${err.message}`;
      }
    });
  }

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
  importForm: els.importForm, importAccount: els.importAccount,
  importFile: els.importFile, importResult: els.importResult,
});

const companyFinancePanel = createFinancePanel('/api/company/finance', {
  statBalance: els.bizStatBalance, statIncome: els.bizStatIncome, statExpense: els.bizStatExpense,
  accountList: els.bizAccountList, accountForm: els.bizAccountForm,
  accountName: els.bizAccountName, accountBalance: els.bizAccountBalance,
  categoryList: els.bizCategoryList, transactionList: els.bizTransactionList,
  transactionForm: els.bizTransactionForm, txAccount: els.bizTxAccount,
  txDescription: els.bizTxDescription, txAmount: els.bizTxAmount,
  txType: els.bizTxType, txCategory: els.bizTxCategory,
  importForm: els.bizImportForm, importAccount: els.bizImportAccount,
  importFile: els.bizImportFile, importResult: els.bizImportResult,
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
    renderMetricsInto(els.metricList, metrics);
    renderMetricSelect(metrics);
    await loadMetricChart();
  } catch (err) {
    els.metricList.innerHTML = `<li class="task-empty">Erro: ${err.message}</li>`;
  }
}

// Lista de últimas leituras, reaproveitada pela aba Saúde e pela Visão Geral.
function renderMetricsInto(listEl, metrics) {
  listEl.innerHTML = '';
  if (!metrics.length) {
    listEl.innerHTML = '<li class="task-empty">Nenhuma métrica registrada ainda.</li>';
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
    listEl.appendChild(li);
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

// ─── Oportunidades ─────────────────────────────────────────────────
const STATUS_LABELS = {
  analisando: 'Analisando',
  em_andamento: 'Em andamento',
  aprovada: 'Aprovada',
  descartada: 'Descartada',
};

async function loadOpportunities() {
  try {
    const { opportunities } = await api('/api/opportunities');
    renderOpportunities(opportunities);
  } catch (err) {
    els.opportunityList.innerHTML = `<li class="task-empty">Erro: ${err.message}</li>`;
  }
}

function renderOpportunities(opportunities) {
  els.opportunityList.innerHTML = '';
  if (!opportunities.length) {
    els.opportunityList.innerHTML = '<li class="task-empty">Nenhuma oportunidade registrada ainda.</li>';
    return;
  }
  opportunities.forEach((opp) => {
    const li = document.createElement('li');
    li.className = 'opportunity-card';

    const header = document.createElement('div');
    header.className = 'opp-header';
    const title = document.createElement('span');
    title.className = 'opp-title';
    title.textContent = opp.title;
    header.appendChild(title);

    const statusSelect = document.createElement('select');
    Object.entries(STATUS_LABELS).forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      if (value === opp.status) option.selected = true;
      statusSelect.appendChild(option);
    });
    statusSelect.addEventListener('change', async () => {
      await api(`/api/opportunities/${opp.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: statusSelect.value }),
      });
      loadOpportunities();
    });
    header.appendChild(statusSelect);
    li.appendChild(header);

    const meta = document.createElement('span');
    meta.className = 'opp-meta';
    const parts = [opp.category];
    if (opp.estimated_value) parts.push(formatCurrency(opp.estimated_value));
    meta.textContent = parts.join(' · ');
    li.appendChild(meta);

    if (opp.description) {
      const desc = document.createElement('span');
      desc.textContent = opp.description;
      li.appendChild(desc);
    }
    if (opp.next_step) {
      const next = document.createElement('span');
      next.className = 'opp-meta';
      next.textContent = `Próximo passo: ${opp.next_step}`;
      li.appendChild(next);
    }

    els.opportunityList.appendChild(li);
  });
}

els.opportunityForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = els.oppTitle.value.trim();
  if (!title) return;
  await api('/api/opportunities', {
    method: 'POST',
    body: JSON.stringify({
      title,
      category: els.oppCategory.value.trim() || 'negocio',
      estimated_value: els.oppValue.value ? Number(els.oppValue.value) : undefined,
    }),
  });
  els.oppTitle.value = '';
  els.oppCategory.value = '';
  els.oppValue.value = '';
  loadOpportunities();
});

// ─── Visão Geral ───────────────────────────────────────────────────
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 52;
els.overviewGaugeFill.style.strokeDasharray = String(GAUGE_CIRCUMFERENCE);

function setGauge(fraction) {
  const clamped = Math.max(0, Math.min(1, fraction));
  els.overviewGaugeFill.style.strokeDashoffset = String(GAUGE_CIRCUMFERENCE * (1 - clamped));
  els.overviewGaugeValue.textContent = `${Math.round(clamped * 100)}%`;
}

async function loadOverview() {
  try {
    const [netWorth, netWorthHistory, personalSummary, companySummary, today, healthMetrics, opportunities] = await Promise.all([
      api('/api/patrimonio/net-worth'),
      api('/api/patrimonio/history?days=30'),
      api('/api/finance/summary?period=month'),
      api('/api/company/finance/summary?period=month'),
      api('/api/routine/today'),
      api('/api/health/metrics'),
      api('/api/opportunities'),
    ]);

    els.ovNetworth.textContent = formatCurrency(netWorth.netWorth);
    els.ovPersonalBalance.textContent = formatCurrency(personalSummary.totalBalance);
    els.ovCompanyBalance.textContent = formatCurrency(companySummary.totalBalance);

    const activeCount = opportunities.opportunities
      .filter((o) => o.status === 'analisando' || o.status === 'em_andamento').length;
    els.ovOpportunities.textContent = String(activeCount);

    renderSparkline(els.overviewNetworthChart, netWorthHistory.history, 'total');
    renderTasksInto(els.ovTasks, today.tasks, loadOverview);
    renderMetricsInto(els.ovHealth, healthMetrics.metrics.slice(0, 5));

    const tasks = today.tasks;
    const completed = tasks.filter((t) => t.status === 'concluida').length;
    setGauge(tasks.length ? completed / tasks.length : 1);

    const pending = tasks.length - completed;
    if (tasks.length === 0) {
      els.overviewHeadline.textContent = 'Nenhuma tarefa marcada para hoje — dia livre.';
    } else if (pending === 0) {
      els.overviewHeadline.textContent = 'Todas as tarefas de hoje concluídas. Bom trabalho.';
    } else {
      els.overviewHeadline.textContent = `${pending} de ${tasks.length} tarefa${tasks.length > 1 ? 's' : ''} ainda pendente${pending > 1 ? 's' : ''} hoje.`;
    }
  } catch (err) {
    els.overviewHeadline.textContent = `Erro ao carregar visão geral: ${err.message}`;
  }
}

// ─── Boot ──────────────────────────────────────────────────────────
if (state.token) {
  showApp();
} else {
  showLogin();
}
