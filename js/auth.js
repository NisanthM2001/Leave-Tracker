/**
 * Authentication Gate & Session Management (Neon PostgreSQL Connected)
 * Personal Leave Tracker
 */

import { STORAGE_KEYS } from '../config.js';
import { showToast } from './state.js';

export function getAuthToken() {
  return sessionStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
}

export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function authFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = options.headers ? { ...options.headers } : {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

export async function checkAuth(onSuccessCallback) {
  const token = getAuthToken();
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');
  const usersTab = document.getElementById('tab-btn-users');

  if (!token) {
    if (loginContainer) loginContainer.classList.remove('hidden');
    if (appContainer) appContainer.classList.add('hidden');
    return;
  }

  try {
    const res = await authFetch('/api/auth/me');
    if (!res.ok) {
      throw new Error('Session expired');
    }
    const data = await res.json();
    const user = data.user;
    sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));

    if (loginContainer) loginContainer.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');

    const userDisplay = document.getElementById('display-username');
    if (userDisplay) {
      userDisplay.textContent = user.displayName || user.username;
    }

    // Toggle Admin-only elements (User Management tab, DB status pill, Year progression toggle)
    const dbStatusPill = document.getElementById('db-status-pill');
    const yearProgressionBox = document.getElementById('admin-year-progression-box');

    if (usersTab) {
      if (user.isAdmin) {
        usersTab.classList.remove('hidden');
      } else {
        usersTab.classList.add('hidden');
        const viewUsers = document.getElementById('view-users');
        if (viewUsers && !viewUsers.classList.contains('hidden')) {
          const trackerTab = document.getElementById('tab-btn-tracker');
          if (trackerTab) trackerTab.click();
        }
      }
    }

    if (dbStatusPill) {
      if (user.isAdmin) {
        dbStatusPill.classList.remove('hidden');
      } else {
        dbStatusPill.classList.add('hidden');
      }
    }

    if (yearProgressionBox) {
      if (user.isAdmin) {
        yearProgressionBox.classList.remove('hidden');
      } else {
        yearProgressionBox.classList.add('hidden');
      }
    }

    if (onSuccessCallback) onSuccessCallback(user);
  } catch (err) {
    console.warn('Auth verification failed:', err);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    if (loginContainer) loginContainer.classList.remove('hidden');
    if (appContainer) appContainer.classList.add('hidden');
  }
}

export async function handleLoginSubmit(e, onSuccessCallback) {
  e.preventDefault();
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const errorBox = document.getElementById('login-error');
  const errorText = document.getElementById('login-error-text');
  const submitBtn = document.getElementById('btn-login-submit');

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    if (errorBox) errorBox.classList.remove('hidden');
    if (errorText) errorText.textContent = 'Please enter both username and password';
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Signing In...</span><span class="spinner-small">⏳</span>';
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      console.error('Server response was not valid JSON:', res.status, res.statusText);
      if (errorBox) errorBox.classList.remove('hidden');
      if (errorText) errorText.textContent = `Backend error (${res.status} ${res.statusText}). Retrying...`;
      return;
    }

    if (res.ok && data.success) {
      if (errorBox) errorBox.classList.add('hidden');
      sessionStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, data.token);
      sessionStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(data.user));

      showToast(`Welcome back, ${data.user.displayName || data.user.username}! 👋`, 'success');
      passwordInput.value = '';

      await checkAuth(onSuccessCallback);
    } else {
      if (errorBox) errorBox.classList.remove('hidden');
      if (errorText) errorText.textContent = data.error || 'Invalid username or password';
      passwordInput.focus();
    }
  } catch (err) {
    console.error('Login fetch error:', err);
    if (errorBox) errorBox.classList.remove('hidden');
    if (errorText) errorText.textContent = 'Connection error. Please check your network connection.';
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Sign In to Tracker</span><span class="arrow-icon">→</span>';
    }
  }
}

export async function handleLogout() {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    // Ignore network error on logout
  }
  sessionStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
  sessionStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  sessionStorage.removeItem(STORAGE_KEYS.SESSION_AUTH);

  showToast('Logged out successfully.', 'info');
  const passInput = document.getElementById('login-password');
  if (passInput) passInput.value = '';
  const errorBox = document.getElementById('login-error');
  if (errorBox) errorBox.classList.add('hidden');
  checkAuth();
}

export function setupAuthEvents(onSuccessCallback) {
  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', (e) => handleLoginSubmit(e, onSuccessCallback));
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  const togglePassBtn = document.getElementById('toggle-password-btn');
  if (togglePassBtn) {
    togglePassBtn.addEventListener('click', () => {
      const passInput = document.getElementById('login-password');
      const eyeIcon = document.getElementById('eye-icon');
      if (passInput.type === 'password') {
        passInput.type = 'text';
        eyeIcon.textContent = '🙈';
      } else {
        passInput.type = 'password';
        eyeIcon.textContent = '👁️';
      }
    });
  }
}
