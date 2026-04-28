'use strict';

const staticPreviewPorts = new Set(['3000', '5173', '5500']);
const runtimeConfig = window.TODOFLOW_CONFIG || {};

function normalizeApiBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getDefaultApiBaseUrl() {
  if (window.location.protocol === 'file:' || staticPreviewPorts.has(window.location.port)) {
    return 'http://localhost:5000';
  }

  return '';
}

const API_BASE_URL = normalizeApiBaseUrl(
  runtimeConfig.API_URL || runtimeConfig.API_BASE_URL || getDefaultApiBaseUrl()
);
const API_RETRY_ATTEMPTS = 3;
const retryableStatusCodes = new Set([408, 425, 429, 500, 502, 503, 504]);

function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const safePath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${safePath}` : safePath;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(url, options = {}, attempts = API_RETRY_ATTEMPTS) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);

      if (!retryableStatusCodes.has(response.status) || attempt === attempts) {
        return response;
      }

      await wait(300 * attempt);
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        throw lastError;
      }

      await wait(300 * attempt);
    }
  }

  throw lastError || new Error('Network request failed');
}

const STORAGE_KEYS = {
  accessToken: 'todoflowAccessToken',
  refreshToken: 'todoflowRefreshToken',
  legacyToken: 'todoToken',
  user: 'todoflowUser',
  legacyUser: 'todoUser',
  theme: 'todoflowTheme',
  queue: 'todoflowOfflineQueue'
};

const unsafePattern = /<[^>]*>|javascript:|data:|on\w+=/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const priorityOrder = { high: 3, medium: 2, low: 1 };

function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch (error) {
    localStorage.removeItem(key);
    return fallback;
  }
}

const state = {
  accessToken: localStorage.getItem(STORAGE_KEYS.accessToken) || localStorage.getItem(STORAGE_KEYS.legacyToken) || '',
  refreshToken: localStorage.getItem(STORAGE_KEYS.refreshToken) || '',
  user: readJSON(STORAGE_KEYS.user, readJSON(STORAGE_KEYS.legacyUser, null)),
  authMode: 'login',
  tasks: [],
  filters: {
    search: '',
    status: 'all',
    priority: '',
    due: 'all',
    sort: 'position'
  },
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 1
  },
  stats: {
    total: 0,
    completed: 0,
    active: 0,
    overdue: 0,
    productivity: 0
  },
  offlineQueue: readJSON(STORAGE_KEYS.queue, []),
  isOffline: !navigator.onLine,
  draggedTaskId: '',
  notifiedTaskIds: new Set(),
  autosaveTimers: new Map(),
  theme: localStorage.getItem(STORAGE_KEYS.theme) || 'light'
};

const elements = {
  authView: document.querySelector('#authView'),
  dashboardView: document.querySelector('#dashboardView'),
  authForm: document.querySelector('#authForm'),
  authEmail: document.querySelector('#authEmail'),
  authPassword: document.querySelector('#authPassword'),
  authSubmit: document.querySelector('#authSubmit'),
  authStatus: document.querySelector('#authStatus'),
  emailError: document.querySelector('#emailError'),
  passwordError: document.querySelector('#passwordError'),
  loginTab: document.querySelector('#loginTab'),
  registerTab: document.querySelector('#registerTab'),
  forgotPasswordButton: document.querySelector('#forgotPasswordButton'),
  resetPanel: document.querySelector('#resetPanel'),
  resetToken: document.querySelector('#resetToken'),
  resetPassword: document.querySelector('#resetPassword'),
  resetPasswordButton: document.querySelector('#resetPasswordButton'),
  logoutButton: document.querySelector('#logoutButton'),
  userEmail: document.querySelector('#userEmail'),
  themeToggle: document.querySelector('#themeToggle'),
  connectionStatus: document.querySelector('#connectionStatus'),
  notificationButton: document.querySelector('#notificationButton'),
  exportButton: document.querySelector('#exportButton'),
  taskForm: document.querySelector('#taskForm'),
  taskTitle: document.querySelector('#taskTitle'),
  taskPriority: document.querySelector('#taskPriority'),
  taskDueDate: document.querySelector('#taskDueDate'),
  taskCategory: document.querySelector('#taskCategory'),
  taskTags: document.querySelector('#taskTags'),
  taskDescription: document.querySelector('#taskDescription'),
  taskError: document.querySelector('#taskError'),
  searchInput: document.querySelector('#searchInput'),
  statusFilter: document.querySelector('#statusFilter'),
  priorityFilter: document.querySelector('#priorityFilter'),
  dueFilter: document.querySelector('#dueFilter'),
  sortSelect: document.querySelector('#sortSelect'),
  taskList: document.querySelector('#taskList'),
  emptyState: document.querySelector('#emptyState'),
  dashboardStatus: document.querySelector('#dashboardStatus'),
  totalCount: document.querySelector('#totalCount'),
  completedCount: document.querySelector('#completedCount'),
  productivityValue: document.querySelector('#productivityValue'),
  overdueCount: document.querySelector('#overdueCount'),
  totalBar: document.querySelector('#totalBar'),
  completedBar: document.querySelector('#completedBar'),
  productivityBar: document.querySelector('#productivityBar'),
  overdueBar: document.querySelector('#overdueBar'),
  prevPageButton: document.querySelector('#prevPageButton'),
  nextPageButton: document.querySelector('#nextPageButton'),
  pageLabel: document.querySelector('#pageLabel'),
  aiInput: document.querySelector('#aiInput'),
  aiSuggestButton: document.querySelector('#aiSuggestButton'),
  aiRewriteButton: document.querySelector('#aiRewriteButton'),
  aiPriorityButton: document.querySelector('#aiPriorityButton'),
  aiResult: document.querySelector('#aiResult'),
  analysisButton: document.querySelector('#analysisButton'),
  planningTips: document.querySelector('#planningTips'),
  toastRoot: document.querySelector('#toastRoot')
};

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function parseTags(value) {
  return normalizeText(value)
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function validateSafeText(label, value, min, max) {
  if (value.length < min) {
    return `${label} obligatoire.`;
  }

  if (value.length > max) {
    return `${label} trop long.`;
  }

  if (unsafePattern.test(value)) {
    return `${label} contient un contenu non autorise.`;
  }

  return '';
}

function validatePassword(password) {
  if (password.length < 8 || password.length > 72) {
    return 'Le mot de passe doit contenir entre 8 et 72 caracteres.';
  }

  return '';
}

function validateStrongPassword(password) {
  const errors = [];

  if (password.length < 8 || password.length > 72) {
    errors.push('8 a 72 caracteres');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('une minuscule');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('une majuscule');
  }

  if (!/\d/.test(password)) {
    errors.push('un chiffre');
  }

  return errors.length ? `Mot de passe requis: ${errors.join(', ')}.` : '';
}

function setText(element, value) {
  element.textContent = value;
}

function setStatus(element, message, type) {
  element.className = `status ${type || ''}`.trim();
  setText(element, message);
}

function setInputError(input, errorElement, message) {
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  setText(errorElement, message);
}

function showToast(message, type = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`.trim();
  toast.textContent = message;
  elements.toastRoot.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function updateConnection(isOffline) {
  state.isOffline = isOffline;
  elements.connectionStatus.textContent = isOffline ? `Offline (${state.offlineQueue.length})` : 'Online';
  elements.connectionStatus.classList.toggle('offline', isOffline);
}

function cacheKey() {
  return state.user ? `todoflowTasks:${state.user.id}` : '';
}

function writeCache() {
  const key = cacheKey();

  if (!key) {
    return;
  }

  localStorage.setItem(key, JSON.stringify({
    tasks: state.tasks,
    stats: state.stats,
    pagination: state.pagination,
    savedAt: new Date().toISOString()
  }));
}

function loadCache() {
  const cached = readJSON(cacheKey(), null);

  if (!cached) {
    return false;
  }

  state.tasks = cached.tasks || [];
  state.stats = cached.stats || computeStats(state.tasks);
  state.pagination = cached.pagination || state.pagination;
  renderStats(state.stats);
  renderTasks();
  return true;
}

function saveQueue() {
  localStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(state.offlineQueue));
  updateConnection(state.isOffline);
}

function saveSession(payload) {
  const accessToken = payload.accessToken || payload.token;

  state.accessToken = accessToken;
  state.refreshToken = payload.refreshToken || state.refreshToken;
  state.user = payload.user;

  localStorage.setItem(STORAGE_KEYS.accessToken, state.accessToken);
  localStorage.setItem(STORAGE_KEYS.refreshToken, state.refreshToken);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(state.user));
  localStorage.removeItem(STORAGE_KEYS.legacyToken);
  localStorage.removeItem(STORAGE_KEYS.legacyUser);
}

function clearSession() {
  state.accessToken = '';
  state.refreshToken = '';
  state.user = null;
  state.tasks = [];
  state.offlineQueue = [];
  state.pagination = { page: 1, limit: 20, total: 0, pages: 1 };
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.queue);
}

async function refreshSession() {
  const response = await fetchWithRetry(buildApiUrl('/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: state.refreshToken })
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || 'Session expiree.');
  }

  saveSession(payload);
  return payload;
}

async function apiFetch(path, options = {}, meta = {}) {
  const headers = new Headers(options.headers || {});

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (state.accessToken) {
    headers.set('Authorization', `Bearer ${state.accessToken}`);
  }

  let response;

  try {
    response = await fetchWithRetry(buildApiUrl(path), {
      ...options,
      headers
    });
    updateConnection(false);
  } catch (error) {
    updateConnection(true);
    throw new Error('Mode offline actif. Les changements seront synchronises.');
  }

  if (response.status === 401 && state.refreshToken && !meta.skipRefresh) {
    await refreshSession();
    return apiFetch(path, options, { ...meta, skipRefresh: true });
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : {};

  if (!response.ok) {
    const details = Array.isArray(payload.details) ? ` ${payload.details.join(' ')}` : '';
    throw new Error(`${payload.message || 'Erreur serveur.'}${details}`);
  }

  return payload;
}

function updateAuthMode(mode) {
  state.authMode = mode;
  const isLogin = mode === 'login';

  elements.loginTab.classList.toggle('active', isLogin);
  elements.registerTab.classList.toggle('active', !isLogin);
  elements.loginTab.setAttribute('aria-selected', String(isLogin));
  elements.registerTab.setAttribute('aria-selected', String(!isLogin));
  elements.authSubmit.textContent = isLogin ? 'Se connecter' : "S'inscrire";
  elements.authPassword.setAttribute('autocomplete', isLogin ? 'current-password' : 'new-password');
  setStatus(elements.authStatus, '', '');
  setInputError(elements.authEmail, elements.emailError, '');
  setInputError(elements.authPassword, elements.passwordError, '');
}

function renderSession() {
  const isAuthenticated = Boolean(state.accessToken && state.user);

  elements.authView.classList.toggle('hidden', isAuthenticated);
  elements.dashboardView.classList.toggle('hidden', !isAuthenticated);
  elements.logoutButton.classList.toggle('hidden', !isAuthenticated);
  elements.userEmail.textContent = isAuthenticated ? state.user.email : '';
  window.dispatchEvent(new CustomEvent('todoflow:session', {
    detail: {
      authenticated: isAuthenticated,
      user: state.user
    }
  }));
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  elements.themeToggle.textContent = state.theme === 'dark' ? 'Clair' : 'Sombre';
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
}

function buildTaskQuery() {
  const params = new URLSearchParams();
  params.set('page', String(state.pagination.page));
  params.set('limit', String(state.pagination.limit));
  params.set('filter', state.filters.status);
  params.set('due', state.filters.due);
  params.set('sort', state.filters.sort);

  if (state.filters.search) {
    params.set('search', state.filters.search);
  }

  if (state.filters.priority) {
    params.set('priority', state.filters.priority);
  }

  return params.toString();
}

function computeStats(tasks) {
  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const completed = tasks.filter((task) => task.completed).length;
  const overdue = tasks.filter((task) => {
    return !task.completed && task.dueDate && new Date(task.dueDate) < todayStart;
  }).length;

  const dueToday = tasks.filter((task) => {
    if (!task.dueDate) {
      return false;
    }

    const due = new Date(task.dueDate);
    return due.toDateString() === now.toDateString();
  }).length;

  return {
    total: tasks.length,
    completed,
    active: tasks.length - completed,
    overdue,
    dueToday,
    highPriority: tasks.filter((task) => !task.completed && task.priority === 'high').length,
    productivity: tasks.length ? Math.round((completed / tasks.length) * 100) : 0
  };
}

function setBar(element, value) {
  const bucket = Math.round(Math.max(0, Math.min(100, value)) / 5) * 5;
  element.className = `fill-${bucket}`;
}

function renderStats(stats) {
  state.stats = stats;
  elements.totalCount.textContent = String(stats.total || 0);
  elements.completedCount.textContent = String(stats.completed || 0);
  elements.productivityValue.textContent = `${stats.productivity || 0}%`;
  elements.overdueCount.textContent = String(stats.overdue || 0);
  setBar(elements.totalBar, stats.total ? 100 : 0);
  setBar(elements.completedBar, stats.total ? (stats.completed / stats.total) * 100 : 0);
  setBar(elements.productivityBar, stats.productivity || 0);
  setBar(elements.overdueBar, stats.total ? (stats.overdue / stats.total) * 100 : 0);
}

async function loadStats() {
  try {
    const stats = await apiFetch('/tasks/stats');
    renderStats(stats);
    writeCache();
  } catch (error) {
    renderStats(computeStats(state.tasks));
  }
}

async function loadTasks() {
  if (!state.accessToken) {
    return;
  }

  try {
    setStatus(elements.dashboardStatus, 'Chargement...', '');
    const payload = await apiFetch(`/tasks?${buildTaskQuery()}`);
    state.tasks = Array.isArray(payload) ? payload : payload.data || [];
    state.pagination = payload.pagination || {
      ...state.pagination,
      total: state.tasks.length,
      pages: 1
    };
    renderTasks();
    await loadStats();
    checkDueNotifications();
    setStatus(elements.dashboardStatus, state.offlineQueue.length ? `${state.offlineQueue.length} action(s) en attente.` : '', '');
    writeCache();
  } catch (error) {
    const hasCache = loadCache();
    setStatus(elements.dashboardStatus, hasCache ? 'Mode offline: donnees locales affichees.' : error.message, hasCache ? '' : 'error');
  }
}

function taskId(task) {
  return task._id || task.id;
}

function formatDateTimeLocal(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value) {
  return value ? new Date(value).toISOString() : null;
}

function formatReadableDate(value) {
  if (!value) {
    return 'Sans date';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date invalide';
  }

  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function replaceTask(updatedTask) {
  const id = taskId(updatedTask);
  state.tasks = state.tasks.map((task) => taskId(task) === id ? updatedTask : task);
}

function updateTaskLocally(id, payload) {
  state.tasks = state.tasks.map((task) => {
    if (taskId(task) !== id) {
      return task;
    }

    return {
      ...task,
      ...payload,
      updatedAt: new Date().toISOString()
    };
  });
  renderStats(computeStats(state.tasks));
  writeCache();
}

function queueOperation(operation) {
  if (operation.type === 'update' && String(operation.id).startsWith('local-')) {
    const createOperation = state.offlineQueue.find((item) => item.type === 'create' && item.tempId === operation.id);

    if (createOperation) {
      createOperation.payload = { ...createOperation.payload, ...operation.payload };
      saveQueue();
      return;
    }
  }

  if (operation.type === 'delete' && String(operation.id).startsWith('local-')) {
    state.offlineQueue = state.offlineQueue.filter((item) => !(item.type === 'create' && item.tempId === operation.id));
    saveQueue();
    return;
  }

  state.offlineQueue.push(operation);
  saveQueue();
}

async function syncOfflineQueue() {
  if (!state.offlineQueue.length || state.isOffline || !state.accessToken) {
    return;
  }

  const remaining = [];
  const idMap = {};

  for (const operation of state.offlineQueue) {
    try {
      if (operation.type === 'create') {
        const createdTask = await apiFetch('/tasks', {
          method: 'POST',
          body: JSON.stringify(operation.payload)
        }, { skipRefresh: false });
        idMap[operation.tempId] = taskId(createdTask);
        state.tasks = state.tasks.map((task) => taskId(task) === operation.tempId ? createdTask : task);
      }

      if (operation.type === 'update') {
        const id = idMap[operation.id] || operation.id;

        if (!String(id).startsWith('local-')) {
          const updatedTask = await apiFetch(`/tasks/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(operation.payload)
          });
          replaceTask(updatedTask);
        }
      }

      if (operation.type === 'delete') {
        const id = idMap[operation.id] || operation.id;

        if (!String(id).startsWith('local-')) {
          await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
        }
      }

      if (operation.type === 'reorder') {
        const orderedIds = operation.orderedIds
          .map((id) => idMap[id] || id)
          .filter((id) => !String(id).startsWith('local-'));

        if (orderedIds.length) {
          await apiFetch('/tasks/reorder', {
            method: 'POST',
            body: JSON.stringify({ orderedIds })
          });
        }
      }
    } catch (error) {
      remaining.push(operation);
    }
  }

  state.offlineQueue = remaining;
  saveQueue();
  renderTasks();
  await loadStats();

  if (!remaining.length) {
    showToast('Synchronisation terminee.', 'success');
  }
}

async function saveTaskPatch(id, payload, options = {}) {
  updateTaskLocally(id, payload);

  if (state.isOffline || String(id).startsWith('local-')) {
    queueOperation({ type: 'update', id, payload });

    if (!options.silent) {
      showToast('Modification gardee en local.', 'success');
    }

    if (options.rerender) {
      renderTasks();
    }

    return;
  }

  try {
    const updatedTask = await apiFetch(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    replaceTask(updatedTask);
    writeCache();

    if (options.rerender) {
      renderTasks();
    }

    if (!options.silent) {
      setStatus(elements.dashboardStatus, 'Tache mise a jour.', 'success');
    }

    await loadStats();
  } catch (error) {
    if (state.isOffline) {
      queueOperation({ type: 'update', id, payload });
      showToast('Modification gardee en local.', 'success');
      return;
    }

    setStatus(elements.dashboardStatus, error.message, 'error');
  }
}

function queueAutosave(id, payload) {
  updateTaskLocally(id, payload);
  const key = `${id}:${Object.keys(payload).sort().join(',')}`;
  window.clearTimeout(state.autosaveTimers.get(key));
  state.autosaveTimers.set(key, window.setTimeout(() => {
    saveTaskPatch(id, payload, { silent: true });
    state.autosaveTimers.delete(key);
  }, 650));
  setStatus(elements.dashboardStatus, 'Sauvegarde...', '');
}

function createSelect(value, options) {
  const select = document.createElement('select');

  options.forEach((option) => {
    const item = document.createElement('option');
    item.value = option.value;
    item.textContent = option.label;
    select.appendChild(item);
  });

  select.value = value;
  return select;
}

function createTaskElement(task) {
  const id = taskId(task);
  const item = document.createElement('li');
  item.className = `task-card ${task.offline ? 'offline' : ''}`.trim();
  item.draggable = true;
  item.dataset.id = id;

  item.addEventListener('dragstart', () => {
    state.draggedTaskId = id;
    item.classList.add('dragging');
  });
  item.addEventListener('dragend', () => item.classList.remove('dragging'));
  item.addEventListener('dragover', (event) => event.preventDefault());
  item.addEventListener('drop', (event) => {
    event.preventDefault();
    reorderTasks(state.draggedTaskId, id);
  });

  const main = document.createElement('div');
  main.className = 'task-main';

  const checkbox = document.createElement('input');
  checkbox.className = 'task-check';
  checkbox.type = 'checkbox';
  checkbox.checked = Boolean(task.completed);
  checkbox.setAttribute('aria-label', `Terminer ${task.title}`);
  checkbox.addEventListener('change', () => saveTaskPatch(id, { completed: checkbox.checked }, { rerender: true }));

  const title = document.createElement('input');
  title.className = `task-title-input ${task.completed ? 'completed' : ''}`.trim();
  title.type = 'text';
  title.maxLength = 120;
  title.value = task.title;
  title.addEventListener('input', () => {
    const cleanTitle = normalizeText(title.value);
    const error = validateSafeText('Titre', cleanTitle, 1, 120);

    if (!error) {
      queueAutosave(id, { title: cleanTitle });
    }
  });

  const priority = createSelect(task.priority || 'medium', [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ]);
  priority.addEventListener('change', () => saveTaskPatch(id, { priority: priority.value }, { rerender: true }));

  const dueDate = document.createElement('input');
  dueDate.type = 'datetime-local';
  dueDate.value = formatDateTimeLocal(task.dueDate);
  dueDate.title = formatReadableDate(task.dueDate);
  dueDate.addEventListener('change', () => saveTaskPatch(id, { dueDate: fromDateTimeLocal(dueDate.value) }, { rerender: true }));

  const deleteButton = document.createElement('button');
  deleteButton.className = 'icon-button danger';
  deleteButton.type = 'button';
  deleteButton.textContent = 'Supprimer';
  deleteButton.addEventListener('click', () => deleteTask(id));

  main.append(checkbox, title, priority, dueDate, deleteButton);

  const details = document.createElement('div');
  details.className = 'task-details';

  const category = document.createElement('input');
  category.type = 'text';
  category.maxLength = 40;
  category.placeholder = 'Categorie';
  category.value = task.category || '';
  category.addEventListener('input', () => {
    const value = normalizeText(category.value);

    if (!validateSafeText('Categorie', value, 0, 40)) {
      queueAutosave(id, { category: value });
    }
  });

  const tags = document.createElement('input');
  tags.type = 'text';
  tags.maxLength = 180;
  tags.placeholder = 'Tags';
  tags.value = (task.tags || []).join(', ');
  tags.addEventListener('input', () => queueAutosave(id, { tags: parseTags(tags.value) }));

  const description = document.createElement('textarea');
  description.rows = 2;
  description.maxLength = 600;
  description.placeholder = 'Notes';
  description.value = task.description || '';
  description.addEventListener('input', () => {
    const value = normalizeText(description.value);

    if (!validateSafeText('Notes', value, 0, 600)) {
      queueAutosave(id, { description: value });
    }
  });

  details.append(category, tags, description);

  const subtasks = createSubtasksElement(task);
  const history = createHistoryElement(task);
  item.append(main, details, subtasks, history);
  return item;
}

function createSubtasksElement(task) {
  const wrapper = document.createElement('div');
  wrapper.className = 'subtasks';
  const id = taskId(task);
  const subtasks = task.subtasks || [];

  subtasks.forEach((subtask, index) => {
    const row = document.createElement('div');
    row.className = 'subtask-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(subtask.completed);
    checkbox.addEventListener('change', () => {
      const next = subtasks.map((item, itemIndex) => itemIndex === index ? { ...item, completed: checkbox.checked } : item);
      saveTaskPatch(id, { subtasks: next }, { rerender: true });
    });

    const title = document.createElement('input');
    title.type = 'text';
    title.maxLength = 120;
    title.value = subtask.title;
    title.addEventListener('input', () => {
      const cleanTitle = normalizeText(title.value);

      if (!validateSafeText('Sous-tache', cleanTitle, 1, 120)) {
        const next = subtasks.map((item, itemIndex) => itemIndex === index ? { ...item, title: cleanTitle } : item);
        queueAutosave(id, { subtasks: next });
      }
    });

    const remove = document.createElement('button');
    remove.className = 'icon-button danger';
    remove.type = 'button';
    remove.textContent = 'Retirer';
    remove.addEventListener('click', () => {
      const next = subtasks.filter((item, itemIndex) => itemIndex !== index);
      saveTaskPatch(id, { subtasks: next }, { rerender: true });
    });

    row.append(checkbox, title, remove);
    wrapper.appendChild(row);
  });

  const addRow = document.createElement('div');
  addRow.className = 'subtask-add';
  const addInput = document.createElement('input');
  addInput.type = 'text';
  addInput.maxLength = 120;
  addInput.placeholder = 'Ajouter une sous-tache';
  const addButton = document.createElement('button');
  addButton.className = 'secondary-button';
  addButton.type = 'button';
  addButton.textContent = 'Ajouter';
  addButton.addEventListener('click', () => {
    const title = normalizeText(addInput.value);

    if (validateSafeText('Sous-tache', title, 1, 120)) {
      return;
    }

    saveTaskPatch(id, { subtasks: [...subtasks, { title, completed: false }] }, { rerender: true });
  });

  addRow.append(addInput, addButton);
  wrapper.appendChild(addRow);
  return wrapper;
}

function createHistoryElement(task) {
  const history = task.history || [];
  const details = document.createElement('details');
  details.className = 'history';

  const summary = document.createElement('summary');
  summary.textContent = `Historique (${history.length})`;
  details.appendChild(summary);

  const list = document.createElement('ul');
  history.slice(-5).reverse().forEach((entry) => {
    const item = document.createElement('li');
    item.textContent = `${entry.field || entry.action} - ${formatReadableDate(entry.changedAt)}`;
    list.appendChild(item);
  });

  details.appendChild(list);
  return details;
}

function renderTasks() {
  elements.taskList.replaceChildren(...state.tasks.map(createTaskElement));
  elements.emptyState.classList.toggle('hidden', state.tasks.length > 0);
  elements.pageLabel.textContent = `${state.pagination.page} / ${state.pagination.pages || 1}`;
  elements.prevPageButton.disabled = state.pagination.page <= 1;
  elements.nextPageButton.disabled = state.pagination.page >= (state.pagination.pages || 1);
}

async function createTask(event) {
  event.preventDefault();

  const title = normalizeText(elements.taskTitle.value);
  const description = normalizeText(elements.taskDescription.value);
  const category = normalizeText(elements.taskCategory.value);
  const tags = parseTags(elements.taskTags.value);
  const titleError = validateSafeText('Titre', title, 1, 120)
    || validateSafeText('Notes', description, 0, 600)
    || validateSafeText('Categorie', category, 0, 40);

  setInputError(elements.taskTitle, elements.taskError, titleError);

  if (titleError) {
    return;
  }

  const payload = {
    title,
    description,
    priority: elements.taskPriority.value,
    dueDate: fromDateTimeLocal(elements.taskDueDate.value),
    category,
    tags
  };

  if (state.isOffline) {
    const tempTask = {
      ...payload,
      _id: `local-${Date.now()}`,
      completed: false,
      subtasks: [],
      history: [],
      offline: true,
      createdAt: new Date().toISOString()
    };
    state.tasks = [tempTask, ...state.tasks];
    queueOperation({ type: 'create', tempId: taskId(tempTask), payload });
    elements.taskForm.reset();
    renderTasks();
    renderStats(computeStats(state.tasks));
    writeCache();
    showToast('Tache creee en local.', 'success');
    return;
  }

  try {
    const task = await apiFetch('/tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.tasks = [task, ...state.tasks];
    elements.taskForm.reset();
    setInputError(elements.taskTitle, elements.taskError, '');
    renderTasks();
    await loadStats();
    writeCache();
    showToast('Tache ajoutee.', 'success');
  } catch (error) {
    setStatus(elements.dashboardStatus, error.message, 'error');
  }
}

async function deleteTask(id) {
  if (!window.confirm('Supprimer cette tache ?')) {
    return;
  }

  state.tasks = state.tasks.filter((task) => taskId(task) !== id);
  renderTasks();
  renderStats(computeStats(state.tasks));
  writeCache();

  if (state.isOffline || String(id).startsWith('local-')) {
    queueOperation({ type: 'delete', id });
    showToast('Suppression gardee en local.', 'success');
    return;
  }

  try {
    await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
    await loadStats();
    showToast('Tache supprimee.', 'success');
  } catch (error) {
    setStatus(elements.dashboardStatus, error.message, 'error');
  }
}

async function reorderTasks(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) {
    return;
  }

  const sourceIndex = state.tasks.findIndex((task) => taskId(task) === sourceId);
  const targetIndex = state.tasks.findIndex((task) => taskId(task) === targetId);

  if (sourceIndex < 0 || targetIndex < 0) {
    return;
  }

  const [moved] = state.tasks.splice(sourceIndex, 1);
  state.tasks.splice(targetIndex, 0, moved);
  state.filters.sort = 'position';
  elements.sortSelect.value = 'position';
  renderTasks();
  writeCache();

  const orderedIds = state.tasks.map(taskId);

  if (state.isOffline) {
    queueOperation({ type: 'reorder', orderedIds });
    showToast('Nouvel ordre garde en local.', 'success');
    return;
  }

  try {
    await apiFetch('/tasks/reorder', {
      method: 'POST',
      body: JSON.stringify({ orderedIds })
    });
  } catch (error) {
    if (state.isOffline) {
      queueOperation({ type: 'reorder', orderedIds });
      return;
    }

    setStatus(elements.dashboardStatus, error.message, 'error');
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const email = elements.authEmail.value.trim().toLowerCase();
  const password = elements.authPassword.value;
  const emailError = !emailPattern.test(email) || email.length > 120 ? 'Email invalide.' : '';
  const passwordError = validatePassword(password);

  setInputError(elements.authEmail, elements.emailError, emailError);
  setInputError(elements.authPassword, elements.passwordError, passwordError);

  if (emailError || passwordError) {
    return;
  }

  try {
    elements.authSubmit.disabled = true;
    setStatus(elements.authStatus, 'Verification...', '');

    const endpoint = state.authMode === 'login' ? '/login' : '/register';
    const payload = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }, { skipRefresh: true });

    saveSession(payload);
    elements.authForm.reset();
    renderSession();
    await loadTasks();
    await syncOfflineQueue();
  } catch (error) {
    setStatus(elements.authStatus, error.message, 'error');
  } finally {
    elements.authSubmit.disabled = false;
  }
}

async function forgotPassword() {
  const email = elements.authEmail.value.trim().toLowerCase();

  if (!emailPattern.test(email)) {
    setStatus(elements.authStatus, 'Renseignez un email valide.', 'error');
    return;
  }

  try {
    const response = await apiFetch('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    }, { skipRefresh: true });

    if (response.debugResetUrl) {
      const url = new URL(response.debugResetUrl);
      elements.resetToken.value = url.searchParams.get('token') || url.searchParams.get('resetToken') || '';
      elements.resetPanel.classList.remove('hidden');
      setStatus(elements.authStatus, `${response.message}. Mode dev: lien de test disponible.`, 'success');
      return;
    }

    setStatus(elements.authStatus, response.message, 'success');
  } catch (error) {
    setStatus(elements.authStatus, error.message, 'error');
  }
}

async function resetPassword() {
  const token = normalizeText(elements.resetToken.value);
  const password = elements.resetPassword.value;
  const passwordError = validateStrongPassword(password);

  if (!token || passwordError) {
    setStatus(elements.authStatus, passwordError || 'Token requis.', 'error');
    return;
  }

  try {
    const response = await apiFetch('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password })
    }, { skipRefresh: true });
    elements.resetPanel.classList.add('hidden');
    setStatus(elements.authStatus, response.message, 'success');
  } catch (error) {
    setStatus(elements.authStatus, error.message, 'error');
  }
}

function inferPriority(title) {
  const text = normalizeText(title).toLowerCase();

  if (/urgent|important|bloquant|deadline|client|prod/.test(text)) {
    return 'high';
  }

  if (/plus tard|idee|lecture|veille|optionnel/.test(text)) {
    return 'low';
  }

  return 'medium';
}

function localAssistant(title) {
  const activeTasks = state.tasks.filter((task) => !task.completed);
  const nextBestTask = activeTasks
    .map((task) => {
      const dueScore = task.dueDate ? Math.max(0, 7 - Math.ceil((new Date(task.dueDate) - Date.now()) / 86400000)) : 0;
      return { task, score: (priorityOrder[task.priority] || 1) * 10 + dueScore };
    })
    .sort((a, b) => b.score - a.score)[0]?.task || null;

  return {
    suggestions: [
      { title: 'Revoir les taches sans date limite', priority: 'medium', tags: ['assistant'] },
      { title: 'Planifier la priorite principale de demain', priority: 'high', tags: ['assistant'] },
      { title: 'Decouper une tache longue en sous-taches', priority: 'medium', tags: ['assistant'] }
    ],
    rewrite: title ? `Finaliser ${normalizeText(title).charAt(0).toLowerCase()}${normalizeText(title).slice(1)}` : '',
    inferredPriority: title ? inferPriority(title) : '',
    nextBestTask,
    planningTips: buildLocalTips()
  };
}

function buildLocalTips() {
  const withoutDueDate = state.tasks.filter((task) => !task.completed && !task.dueDate).length;
  const highOpen = state.tasks.filter((task) => !task.completed && task.priority === 'high').length;
  const tips = [];

  if (withoutDueDate > 2) {
    tips.push('Ajoutez des echeances aux taches actives sans date.');
  }

  if (highOpen > 3) {
    tips.push('Gardez trois priorites hautes maximum pour conserver le focus.');
  }

  if (!tips.length) {
    tips.push('Votre tableau est equilibre pour une revue quotidienne courte.');
  }

  return tips;
}

function renderAssistantResult(data, mode) {
  elements.aiResult.replaceChildren();

  if (mode === 'suggest') {
    data.suggestions.forEach((suggestion) => {
      const chip = document.createElement('div');
      chip.className = 'ai-chip';
      chip.textContent = suggestion.title;
      const button = document.createElement('button');
      button.className = 'secondary-button';
      button.type = 'button';
      button.textContent = 'Creer';
      button.addEventListener('click', () => {
        elements.taskTitle.value = suggestion.title;
        elements.taskPriority.value = suggestion.priority;
        elements.taskTags.value = (suggestion.tags || []).join(', ');
        elements.taskTitle.focus();
      });
      chip.appendChild(button);
      elements.aiResult.appendChild(chip);
    });
    return;
  }

  const chip = document.createElement('div');
  chip.className = 'ai-chip';

  if (mode === 'rewrite') {
    chip.textContent = data.rewrite || 'Ajoutez une tache a reformuler.';
  }

  if (mode === 'priority') {
    chip.textContent = data.inferredPriority ? `Priorite proposee: ${data.inferredPriority}` : 'Ajoutez une tache a prioriser.';

    if (data.inferredPriority) {
      elements.taskPriority.value = data.inferredPriority;
    }
  }

  if (data.nextBestTask) {
    const next = document.createElement('p');
    next.textContent = `Focus: ${data.nextBestTask.title}`;
    chip.appendChild(next);
  }

  elements.aiResult.appendChild(chip);
}

async function runAssistant(mode) {
  const title = normalizeText(elements.aiInput.value || elements.taskTitle.value);

  try {
    const data = await apiFetch('/tasks/ai/assistant', {
      method: 'POST',
      body: JSON.stringify({ title })
    });
    renderAssistantResult(data, mode);
  } catch (error) {
    renderAssistantResult(localAssistant(title), mode);
  }
}

async function runAnalysis() {
  try {
    const data = await apiFetch('/tasks/ai/analysis');
    renderPlanningTips(data.tips || []);
  } catch (error) {
    renderPlanningTips(buildLocalTips());
  }
}

function renderPlanningTips(tips) {
  elements.planningTips.replaceChildren(...tips.map((tip) => {
    const item = document.createElement('li');
    item.textContent = tip;
    return item;
  }));
}

async function exportTasks() {
  try {
    const payload = await apiFetch('/tasks/export');
    downloadJSON('todoflow-export.json', payload);
  } catch (error) {
    downloadJSON('todoflow-export-local.json', {
      exportedAt: new Date().toISOString(),
      tasks: state.tasks
    });
  }
}

function downloadJSON(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function checkDueNotifications() {
  const now = Date.now();
  const soon = now + 24 * 60 * 60 * 1000;

  state.tasks.forEach((task) => {
    const id = taskId(task);

    if (task.completed || !task.dueDate || state.notifiedTaskIds.has(id)) {
      return;
    }

    const due = new Date(task.dueDate).getTime();

    if (due >= now && due <= soon) {
      state.notifiedTaskIds.add(id);
      const message = `${task.title} arrive a echeance ${formatReadableDate(task.dueDate)}.`;
      showToast(message, 'success');

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('TodoFlow', { body: message });
      }
    }
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

async function setupPushNotifications(publicKey) {
  if (!publicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });

  await apiFetch('/notifications/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription })
  });
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    showToast('Notifications non supportees.', 'error');
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    showToast('Notifications refusees.', 'error');
    return;
  }

  try {
    const config = await apiFetch('/notifications/config');
    await setupPushNotifications(config.publicVapidKey);
    showToast(config.publicVapidKey ? 'Notifications activees.' : 'Notifications locales activees.', 'success');
    checkDueNotifications();
  } catch (error) {
    showToast('Notifications locales activees.', 'success');
  }
}

function bindFilters() {
  let searchTimer = 0;

  elements.searchInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.filters.search = normalizeText(elements.searchInput.value);
      state.pagination.page = 1;
      loadTasks();
    }, 260);
  });

  [
    [elements.statusFilter, 'status'],
    [elements.priorityFilter, 'priority'],
    [elements.dueFilter, 'due'],
    [elements.sortSelect, 'sort']
  ].forEach(([element, key]) => {
    element.addEventListener('change', () => {
      state.filters[key] = element.value;
      state.pagination.page = 1;
      loadTasks();
    });
  });
}

function bindEvents() {
  elements.authForm.addEventListener('submit', handleAuthSubmit);
  elements.loginTab.addEventListener('click', () => updateAuthMode('login'));
  elements.registerTab.addEventListener('click', () => updateAuthMode('register'));
  elements.forgotPasswordButton.addEventListener('click', forgotPassword);
  elements.resetPasswordButton.addEventListener('click', resetPassword);
  elements.logoutButton.addEventListener('click', async () => {
    try {
      await apiFetch('/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: state.refreshToken })
      });
    } catch (error) {
      // Logout stays local if the server cannot be reached.
    }

    clearSession();
    renderSession();
    renderTasks();
  });

  elements.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
  });

  elements.taskForm.addEventListener('submit', createTask);
  elements.exportButton.addEventListener('click', exportTasks);
  elements.notificationButton.addEventListener('click', enableNotifications);
  elements.prevPageButton.addEventListener('click', () => {
    state.pagination.page = Math.max(1, state.pagination.page - 1);
    loadTasks();
  });
  elements.nextPageButton.addEventListener('click', () => {
    state.pagination.page = Math.min(state.pagination.pages || 1, state.pagination.page + 1);
    loadTasks();
  });

  elements.aiSuggestButton.addEventListener('click', () => runAssistant('suggest'));
  elements.aiRewriteButton.addEventListener('click', () => runAssistant('rewrite'));
  elements.aiPriorityButton.addEventListener('click', () => runAssistant('priority'));
  elements.analysisButton.addEventListener('click', runAnalysis);

  bindFilters();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') {
    return;
  }

  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

function hydrateResetTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || params.get('resetToken');

  if (token) {
    elements.resetToken.value = token;
    elements.resetPanel.classList.remove('hidden');
  }
}

window.addEventListener('online', async () => {
  updateConnection(false);
  await syncOfflineQueue();
  await loadTasks();
});

window.addEventListener('offline', () => updateConnection(true));

applyTheme();
updateConnection(state.isOffline);
updateAuthMode('login');
bindEvents();
hydrateResetTokenFromUrl();
registerServiceWorker();
renderSession();
renderPlanningTips(buildLocalTips());

if (state.accessToken && state.user) {
  loadTasks().then(syncOfflineQueue);
}

window.setInterval(checkDueNotifications, 60 * 1000);
