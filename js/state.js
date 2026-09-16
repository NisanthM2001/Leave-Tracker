/**
 * State Management & Storage Persistence
 * Personal Leave Tracker
 */

import { STORAGE_KEYS, DEFAULT_YEARS, DEFAULT_LEAVE_TYPES, SEED_ENTRIES_2026, DAY_NAMES } from '../config.js';

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
  dashboardYear: 'ALL'
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

export function loadFromStorage() {
  try {
    const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (savedSettings) {
      state.settings = JSON.parse(savedSettings);
    }
  } catch (e) {
    console.error('Error loading settings', e);
  }

  try {
    const savedEntries = localStorage.getItem(STORAGE_KEYS.ENTRIES);
    if (savedEntries) {
      state.entries = JSON.parse(savedEntries);
    } else {
      seedInitialData();
    }
  } catch (e) {
    console.error('Error loading entries', e);
    seedInitialData();
  }

  normalizeData();
}

export function saveSettingsToStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(state.settings));
  } catch (e) {
    console.error('Failed to persist settings', e);
  }
}

export function saveEntriesToStorage() {
  try {
    normalizeData();
    localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(state.entries));
    updateGlobalBadges();
  } catch (e) {
    console.error('Failed to persist entries', e);
  }
}

export function seedInitialData() {
  state.entries = {};
  state.settings.years = [2026];

  state.entries[2026] = SEED_ENTRIES_2026.map((item, idx) => ({
    id: generateId(),
    sNo: idx + 1,
    date: item.date,
    day: getDayName(item.date),
    leaveType: item.leaveType,
    reason: item.reason
  }));

  saveSettingsToStorage();
  saveEntriesToStorage();
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
