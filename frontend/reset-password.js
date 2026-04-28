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

function buildApiUrl(path) {
  const safePath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${safePath}` : safePath;
}

function validatePassword(password) {
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

const elements = {
  form: document.querySelector('#resetPasswordForm'),
  token: document.querySelector('#resetTokenInput'),
  password: document.querySelector('#newPasswordInput'),
  passwordError: document.querySelector('#newPasswordError'),
  submit: document.querySelector('#resetSubmitButton'),
  status: document.querySelector('#resetStatus')
};

function setStatus(message, type = '') {
  elements.status.className = `status ${type}`.trim();
  elements.status.textContent = message;
}

function hydrateToken() {
  const params = new URLSearchParams(window.location.search);
  elements.token.value = params.get('token') || params.get('resetToken') || '';
}

async function submitReset(event) {
  event.preventDefault();

  const token = elements.token.value.trim();
  const password = elements.password.value;
  const passwordError = validatePassword(password);

  elements.passwordError.textContent = passwordError;

  if (!token || passwordError) {
    setStatus(token ? passwordError : 'Token requis.', 'error');
    return;
  }

  try {
    elements.submit.disabled = true;
    setStatus('Reinitialisation...', '');

    const response = await fetch(buildApiUrl('/reset-password'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const details = Array.isArray(payload.details) ? ` ${payload.details.join(' ')}` : '';
      throw new Error(`${payload.message || 'Erreur serveur.'}${details}`);
    }

    elements.form.reset();
    setStatus(payload.message || 'Mot de passe reinitialise.', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    elements.submit.disabled = false;
  }
}

hydrateToken();
elements.form.addEventListener('submit', submitReset);
