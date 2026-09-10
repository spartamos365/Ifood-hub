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
  messages: document.getElementById('messages'),
  chatForm: document.getElementById('chat-form'),
  chatText: document.getElementById('chat-text'),
  briefingText: document.getElementById('briefing-text'),
  genBriefingBtn: document.getElementById('gen-briefing-btn'),
  taskList: document.getElementById('task-list'),
  taskForm: document.getElementById('task-form'),
  taskTitle: document.getElementById('task-title'),
  taskDue: document.getElementById('task-due'),
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
    if (tab === 'routine') loadRoutine();
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

// ─── Boot ──────────────────────────────────────────────────────────
if (state.token) {
  showApp();
} else {
  showLogin();
}
