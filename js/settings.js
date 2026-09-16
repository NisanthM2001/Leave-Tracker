/**
 * Settings & Configuration (Leave Types & Years)
 * Personal Leave Tracker
 */

import { state, showToast, saveSettingsToStorage, saveEntriesToStorage } from './state.js';
import { renderLeaveTracker } from './tracker.js';
import { handleExportPrompt, handleImportFile } from './data-io.js';

export function renderSettings() {
  renderSettingsLeaveTypes();
  renderSettingsYears();
}

function renderSettingsLeaveTypes() {
  const list = document.getElementById('settings-leave-types-list');
  const countBadge = document.getElementById('leave-types-count');
  if (!list) return;
  list.innerHTML = '';
  countBadge.textContent = `${state.settings.leaveTypes.length} types`;

  state.settings.leaveTypes.forEach((t, idx) => {
    const li = document.createElement('li');
    li.className = 'settings-list-item';
    li.innerHTML = `
      <div class="settings-item-label">
        <span class="settings-item-dot" style="background-color: var(--leave-${t.color || 'blue'}-border, #4472C4);"></span>
        <span>${t.name}</span>
        <span style="font-size: 0.75rem; color: var(--text-muted);">(${t.color})</span>
      </div>
      <button type="button" class="btn-remove-setting" title="Remove leave type">✕</button>
    `;

    li.querySelector('.btn-remove-setting').addEventListener('click', () => {
      if (state.settings.leaveTypes.length <= 1) {
        showToast('You must keep at least one leave type.', 'error');
        return;
      }
      if (confirm(`Remove leave type "${t.name}"? Existing entries will keep their text.`)) {
        state.settings.leaveTypes.splice(idx, 1);
        saveSettingsToStorage();
        renderSettings();
        renderLeaveTracker();
        showToast(`Removed leave type "${t.name}".`, 'info');
      }
    });

    list.appendChild(li);
  });
}

function renderSettingsYears() {
  const chipGrid = document.getElementById('settings-years-list');
  const countBadge = document.getElementById('years-count');
  if (!chipGrid) return;
  chipGrid.innerHTML = '';
  countBadge.textContent = `${state.settings.years.length} active years`;

  state.settings.years.slice().sort((a, b) => a - b).forEach(y => {
    const chip = document.createElement('div');
    chip.className = 'year-chip';
    chip.innerHTML = `
      <span>${y}</span>
      <button type="button" title="Remove Year ${y} from tracking">✕</button>
    `;

    // Warning before closing Active Tracking Years
    chip.querySelector('button').addEventListener('click', () => {
      const recordsCount = (state.entries[y] || []).length;
      const warningMsg = `⚠️ Warning: Are you sure you want to remove Year ${y} from Active Tracking?\n\n` +
        (recordsCount > 0 
          ? `This year contains ${recordsCount} recorded leave entry(ies) that will be permanently removed.` 
          : `Year ${y} will be removed from your tracking list.`);
      
      if (confirm(warningMsg)) {
        state.settings.years = state.settings.years.filter(year => year !== y);
        delete state.entries[y];
        saveSettingsToStorage();
        saveEntriesToStorage();
        renderSettings();
        renderLeaveTracker();
        showToast(`Removed Year ${y} from Active Tracking.`, 'info');
      }
    });

    chipGrid.appendChild(chip);
  });
}

export function setupSettingsForms() {
  // Add Leave Type
  const typeForm = document.getElementById('form-add-leave-type');
  if (typeForm) {
    typeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('input-new-leave-type');
      const colorSelect = document.getElementById('select-new-leave-color');
      const name = nameInput.value.trim();
      const color = colorSelect.value;
      if (!name) return;

      if (state.settings.leaveTypes.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        showToast('This leave type already exists!', 'error');
        return;
      }

      state.settings.leaveTypes.push({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name: name,
        color: color,
        category: 'Custom'
      });
      saveSettingsToStorage();
      nameInput.value = '';
      renderSettings();
      renderLeaveTracker();
      showToast(`Added "${name}" leave type!`, 'success');
    });
  }

  // Add Year (Unlimited)
  const yearForm = document.getElementById('form-add-year');
  if (yearForm) {
    yearForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const yearInput = document.getElementById('input-new-year');
      const newYear = parseInt(yearInput.value, 10);
      if (isNaN(newYear) || newYear < 2000) {
        showToast('Please enter a valid 4-digit year (2000+).', 'error');
        return;
      }
      if (state.settings.years.includes(newYear)) {
        showToast(`Year ${newYear} already exists!`, 'error');
        return;
      }
      state.settings.years.push(newYear);
      state.settings.years.sort((a, b) => a - b);
      state.entries[newYear] = [];
      saveSettingsToStorage();
      saveEntriesToStorage();
      yearInput.value = '';
      renderSettings();
      renderLeaveTracker();
      showToast(`Year ${newYear} added!`, 'success');
    });
  }

  // Export & Import Handlers
  const exportBtn = document.getElementById('btn-export-data');
  if (exportBtn) exportBtn.addEventListener('click', handleExportPrompt);

  const importInput = document.getElementById('file-import-data');
  if (importInput) importInput.addEventListener('change', handleImportFile);
}
