/**
 * State Management & Database Persistence (Neon PostgreSQL)
 * Personal Leave Tracker
 */

import { STORAGE_KEYS, DEFAULT_YEARS, DEFAULT_LEAVE_TYPES, DAY_NAMES } from '../config.js';
import { authFetch } from './auth.js';

export const state = {
  settings: {
    years: [...DEFAULT_YEARS],
    leaveTypes: [...DEFAULT_LEAVE_TYPES]
  },
  entries: {},
  filters: {
    search: '',
    leaveType: 'ALL',
    month: 'ALL',
    year: 'ALL'
  },
  sort: {
    column: 'sNo',
    direction: 'asc'
  },
  collapsedYears: {},
  dashboardYear: 'ALL',
  isSyncing: false
};

export function generateId() {
  return 'entry_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function getDayName(dateString) {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  if (isNaN(d.getTime())) return '';
  return DAY_NAMES[d.getDay()] || '';
}

export function isWeekend(dayName) {
  return dayName === 'Saturday' || dayName === 'Sunday';
}

export function getLeaveTypeObj(typeName) {
  return state.settings.leaveTypes.find(
    t => t.name.toLowerCase() === (typeName || '').toLowerCase()
  );
}

export function getLeaveColorClass(typeName) {
  const typeObj = getLeaveTypeObj(typeName);
  if (!typeObj) return '';
  return `row-leave-${typeObj.color || 'blue'}`;
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

// Load data directly from Neon PostgreSQL
export async function loadFromStorage() {
  try {
    const res = await authFetch('/api/data');
    if (res.ok) {
      const data = await res.json();
      if (data.settings) {
        state.settings = data.settings;
      }
      if (data.entries) {
        state.entries = data.entries;
      }
    } else {
      console.warn('Could not load data from API, using defaults');
    }
  } catch (e) {
    console.error('Error fetching data from Neon DB:', e);
  }

  normalizeData();
  updateGlobalBadges();
  updateDbStatusPill();
}

export async function saveSettingsToStorage() {
  try {
    // Send to Neon PostgreSQL
    await authFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.settings)
    });
  } catch (e) {
    console.error('Failed to persist settings to DB', e);
  }
}

// Debounce helper for entry saving
let saveEntriesTimer = null;

export function saveEntriesToStorage(immediate = false) {
  normalizeData();
  updateGlobalBadges();

  if (saveEntriesTimer) {
    clearTimeout(saveEntriesTimer);
    saveEntriesTimer = null;
  }

  if (immediate) {
    syncEntriesToDB();
  } else {
    saveEntriesTimer = setTimeout(() => {
      syncEntriesToDB();
    }, 600);
  }
}

async function syncEntriesToDB() {
  state.isSyncing = true;
  updateSyncIndicator(true);

  try {
    const res = await authFetch('/api/entries/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: state.entries })
    });

    if (!res.ok) {
      console.warn('Sync response not ok:', res.status);
    }
  } catch (e) {
    console.error('Failed to sync entries with Neon DB:', e);
  } finally {
    state.isSyncing = false;
    updateSyncIndicator(false);
  }
}

function updateSyncIndicator(isSyncing) {
  const syncPill = document.getElementById('db-sync-indicator');
  if (syncPill) {
    if (isSyncing) {
      syncPill.innerHTML = '<span class="pill-dot syncing"></span><span>Saving to DB...</span>';
    } else {
      syncPill.innerHTML = '<span class="pill-dot connected"></span><span>Saved to DB</span>';
    }
  }
}

export async function updateDbStatusPill() {
  const pill = document.getElementById('db-status-pill');
  if (!pill) return;
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      pill.innerHTML = `<span class="db-dot online"></span><span>Neon DB (${data.latencyMs}ms)</span>`;
      pill.title = `Connected to Neon PostgreSQL • Latency: ${data.latencyMs}ms`;
    } else {
      pill.innerHTML = `<span class="db-dot offline"></span><span>DB Offline</span>`;
    }
  } catch (e) {
    pill.innerHTML = `<span class="db-dot offline"></span><span>DB Offline</span>`;
  }
}

export function normalizeData() {
  state.settings.years.forEach(year => {
    if (!state.entries[year] || !Array.isArray(state.entries[year])) {
      state.entries[year] = [];
    }
    // Maintain strict S.No in ascending order: 1, 2, 3...
    state.entries[year].forEach((row, i) => {
      row.sNo = i + 1;
      if (row.date && !row.day) {
        row.day = getDayName(row.date);
      }
    });
  });

  Object.keys(state.entries).forEach(y => {
    const numY = parseInt(y, 10);
    if (!state.settings.years.includes(numY)) {
      state.settings.years.push(numY);
    }
  });

  state.settings.years.sort((a, b) => a - b);
}

export function updateGlobalBadges() {
  let totalRecords = 0;
  Object.keys(state.entries).forEach(year => {
    const active = (state.entries[year] || []).filter(r => r.date || r.reason);
    totalRecords += active.length;
  });

  const badge = document.getElementById('tracker-entry-count');
  if (badge) badge.textContent = totalRecords;

  const quickText = document.getElementById('quick-stats-text');
  if (quickText) quickText.textContent = `${totalRecords} Total Records`;
}
