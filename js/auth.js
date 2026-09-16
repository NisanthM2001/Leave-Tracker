/**
 * Authentication Gate (Client-Side)
 * Personal Leave Tracker
 * 
 * Note: Suitable for personal single-user workstation use.
 */

import { USER_CONFIG, STORAGE_KEYS } from '../config.js';
import { showToast } from './state.js';

export function checkAuth(onSuccessCallback) {
  const isAuth = sessionStorage.getItem(STORAGE_KEYS.SESSION_AUTH) === 'true';
  const loginContainer = document.getElementById('login-container');
  const appContainer = document.getElementById('app-container');

  if (isAuth) {
    loginContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    const userDisplay = document.getElementById('display-username');
    if (userDisplay) userDisplay.textContent = USER_CONFIG.displayName || USER_CONFIG.username;
    if (onSuccessCallback) onSuccessCallback();
  } else {
    loginContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
  }
}

export function handleLoginSubmit(e, onSuccessCallback) {
  e.preventDefault();
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const errorBox = document.getElementById('login-error');

  const enteredUser = usernameInput.value.trim();
  const enteredPass = passwordInput.value;

  if (enteredUser === USER_CONFIG.username && enteredPass === USER_CONFIG.password) {
    errorBox.classList.add('hidden');
    sessionStorage.setItem(STORAGE_KEYS.SESSION_AUTH, 'true');
    showToast(`Welcome back, ${USER_CONFIG.displayName || USER_CONFIG.username}! 👋`, 'success');
    checkAuth(onSuccessCallback);
  } else {
    errorBox.classList.remove('hidden');
    document.getElementById('login-error-text').textContent = 'Invalid username or password';
    passwordInput.focus();
  }
}

export function handleLogout() {
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
