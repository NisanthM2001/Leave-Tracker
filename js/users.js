/**
 * User Management Tab (Exclusive to Nisanth / Admin)
 * Personal Leave Tracker
 */

import { authFetch, getCurrentUser } from './auth.js';
import { showToast } from './state.js';

let cachedUsers = [];

export async function renderUserManagement() {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.isAdmin) return;

  await loadUsersList();
  renderDbDetailsCard();
}

export async function loadUsersList() {
  const tbody = document.getElementById('users-table-body');
  const countBadge = document.getElementById('users-total-count');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="table-loading-notice">Loading users from Neon DB...</td></tr>`;

  try {
    const res = await authFetch('/api/admin/users');
    if (!res.ok) {
      const err = await res.json();
      tbody.innerHTML = `<tr><td colspan="6" class="table-error-notice">Failed to load users: ${err.error || res.statusText}</td></tr>`;
      return;
    }

    const data = await res.json();
    cachedUsers = data.users || [];

    if (countBadge) {
      countBadge.textContent = `${cachedUsers.length} User${cachedUsers.length === 1 ? '' : 's'}`;
    }

    renderUsersTable(cachedUsers);
  } catch (err) {
    console.error('Error fetching users:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="table-error-notice">Network error fetching users list.</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const currentUser = getCurrentUser();

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty-notice">No other users created yet. Use the form on the left to add users.</td></tr>`;
    return;
  }

  users.forEach((u) => {
    const tr = document.createElement('tr');
    tr.className = 'user-row';

    const isSelf = currentUser && currentUser.id === u.id;
    const isPrimaryAdmin = u.username.toLowerCase() === 'nisanth';

    const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) : '—';

    const initial = (u.displayName || u.username || 'U').charAt(0).toUpperCase();

    tr.innerHTML = `
      <td>
        <div class="user-cell-profile">
          <div class="user-avatar-circle ${u.isAdmin ? 'avatar-admin' : ''}">${initial}</div>
          <div class="user-profile-info">
            <span class="user-display-title">${escapeHtml(u.displayName || u.username)} ${isSelf ? '<span class="pill-you">You</span>' : ''}</span>
            <span class="user-username-subtitle">@${escapeHtml(u.username)}</span>
          </div>
        </div>
      </td>
      <td>
        <span class="badge-role ${u.isAdmin ? 'role-admin' : 'role-user'}">
          ${u.isAdmin ? '👑 Administrator' : '👤 Standard User'}
        </span>
      </td>
      <td class="text-center">
        <span class="badge-entries-count">${u.entryCount || 0}</span>
      </td>
      <td>
        <span class="user-created-date">${dateStr}</span>
      </td>
      <td class="text-right">
        <div class="user-action-buttons">
          <button type="button" class="btn btn-ghost btn-sm btn-reset-pass" title="Change or reset password for ${escapeHtml(u.username)}">
            🔑 Reset Password
          </button>
          ${(!isSelf && !isPrimaryAdmin) ? `
            <button type="button" class="btn btn-danger-outline btn-sm btn-delete-user" title="Delete account for ${escapeHtml(u.username)}">
              🗑️ Delete
            </button>
          ` : `
            <span class="protected-badge" title="Primary Admin account cannot be deleted">🔒 Protected</span>
          `}
        </div>
      </td>
    `;

    // Reset Password Handler
    tr.querySelector('.btn-reset-pass').addEventListener('click', () => {
      promptResetPassword(u);
    });

    // Delete User Handler
    const delBtn = tr.querySelector('.btn-delete-user');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        confirmDeleteUser(u);
      });
    }

    tbody.appendChild(tr);
  });
}

async function promptResetPassword(user) {
  const newPass = prompt(`Enter new password for user "${user.username}":`, '');
  if (!newPass || !newPass.trim()) return;

  if (newPass.trim().length < 3) {
    showToast('Password must be at least 3 characters long', 'error');
    return;
  }

  try {
    const res = await authFetch(`/api/admin/users/${user.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: newPass.trim() })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Password updated for "${user.username}"! ✅`, 'success');
    } else {
      showToast(data.error || 'Failed to update password', 'error');
    }
  } catch (err) {
    showToast('Network error resetting password', 'error');
  }
}

async function confirmDeleteUser(user) {
  const confirmMsg = `⚠️ Are you sure you want to delete user "${user.displayName || user.username}" (@${user.username})?\n\nThis will permanently remove their access and all ${user.entryCount || 0} leave entries stored in Neon DB.`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await authFetch(`/api/admin/users/${user.id}`, {
      method: 'DELETE'
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`User "${user.username}" deleted.`, 'info');
      await loadUsersList();
    } else {
      showToast(data.error || 'Failed to delete user', 'error');
    }
  } catch (err) {
    showToast('Network error deleting user', 'error');
  }
}

export function setupUsersEvents() {
  // Create User Form
  const form = document.getElementById('form-create-user');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('new-user-username');
      const passwordInput = document.getElementById('new-user-password');
      const displayInput = document.getElementById('new-user-displayname');
      const adminCheckbox = document.getElementById('new-user-is-admin');
      const submitBtn = document.getElementById('btn-create-user-submit');

      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();
      const displayName = displayInput.value.trim() || username;
      const isAdmin = adminCheckbox ? adminCheckbox.checked : false;

      if (!username || !password) {
        showToast('Username and password are required', 'error');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Creating User...</span><span class="spinner-small">⏳</span>';
      }

      try {
        const res = await authFetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, displayName, isAdmin })
        });

        const data = await res.json();

        if (res.ok && data.success) {
          showToast(`User "${data.user.username}" created successfully! 🎉`, 'success');
          form.reset();
          await loadUsersList();
        } else {
          showToast(data.error || 'Failed to create user', 'error');
        }
      } catch (err) {
        showToast('Network error creating user', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>➕ Create User Account</span>';
        }
      }
    });
  }

  // Refresh Users Button
  const refreshBtn = document.getElementById('btn-refresh-users');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await loadUsersList();
      showToast('User list refreshed from DB', 'info');
    });
  }

  // Password toggle in Create User form
  const toggleBtn = document.getElementById('toggle-new-password-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const passInp = document.getElementById('new-user-password');
      const eye = document.getElementById('new-user-eye');
      if (passInp.type === 'password') {
        passInp.type = 'text';
        if (eye) eye.textContent = '🙈';
      } else {
        passInp.type = 'password';
        if (eye) eye.textContent = '👁️';
      }
    });
  }
}

async function renderDbDetailsCard() {
  const hostEl = document.getElementById('db-info-host');
  const latencyEl = document.getElementById('db-info-latency');
  const timeEl = document.getElementById('db-info-time');

  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      if (hostEl) hostEl.textContent = 'ep-rough-pond-b4ga7ctf-pooler.c-6.us-east-2.aws.neon.tech';
      if (latencyEl) latencyEl.textContent = `${data.latencyMs} ms (Optimal)`;
      if (timeEl) timeEl.textContent = new Date(data.serverTime).toLocaleTimeString();
    }
  } catch (e) {
    // Ignore
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
