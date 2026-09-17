/**
 * Settings & Configuration (Leave Types Modal & Auto Year Progression)
 * Personal Leave Tracker
 */

import { state, showToast, saveSettingsToStorage, saveEntriesToStorage } from './state.js';
import { renderLeaveTracker } from './tracker.js';
import { renderDashboard } from './dashboard.js';
import { handleExportPrompt, handleImportFile } from './data-io.js';

let currentSelectedEmoji = '🏖️';

export function renderSettings() {
  renderSettingsLeaveTypes();
  renderSettingsYears();
  initAutoYearToggleState();
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
        <span class="settings-item-icon">${t.icon || '📌'}</span>
        <span class="settings-item-dot" style="background-color: var(--leave-${t.color || 'blue'}-border, #4472C4);"></span>
        <span class="settings-item-name">${t.name}</span>
        <span class="settings-item-meta">(${t.category || 'General'})</span>
      </div>
      <button type="button" class="btn-remove-setting" title="Remove ${t.name}">✕</button>
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
        renderDashboard();
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
  countBadge.textContent = `${state.settings.years.length} active year${state.settings.years.length === 1 ? '' : 's'}`;

  state.settings.years.slice().sort((a, b) => a - b).forEach(y => {
    const chip = document.createElement('div');
    chip.className = 'year-chip';
    chip.innerHTML = `
      <span class="year-chip-icon">📅</span>
      <span>${y}</span>
    `;
    chipGrid.appendChild(chip);
  });
}

function initAutoYearToggleState() {
  const toggle = document.getElementById('toggle-auto-year-unlock');
  if (toggle) {
    const isAuto = localStorage.getItem('leave_tracker_auto_year_unlock') !== 'false';
    toggle.checked = isAuto;
  }
}

export function setupSettingsForms() {
  // 1. Open Add Leave Type Modal
  const openModalBtn = document.getElementById('btn-open-add-type-modal');
  const modal = document.getElementById('modal-add-leave-type');
  const closeModalBtn = document.getElementById('btn-close-modal-type');
  const cancelModalBtn = document.getElementById('btn-cancel-modal-type');

  function openModal() {
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    const nameInp = document.getElementById('modal-input-type-name');
    if (nameInp) {
      nameInp.value = '';
      setTimeout(() => nameInp.focus(), 50);
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  if (openModalBtn) openModalBtn.addEventListener('click', openModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // 2. Emoji Selection in Modal
  const presetChips = document.querySelectorAll('#modal-emoji-presets .emoji-chip');
  const preview = document.getElementById('selected-emoji-preview');
  const customEmojiInput = document.getElementById('modal-input-custom-emoji');

  presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      presetChips.forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      currentSelectedEmoji = chip.getAttribute('data-emoji') || '🏖️';
      if (preview) preview.textContent = currentSelectedEmoji;
      if (customEmojiInput) customEmojiInput.value = '';
    });
  });

  if (customEmojiInput) {
    customEmojiInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) {
        presetChips.forEach(c => c.classList.remove('selected'));
        currentSelectedEmoji = val;
        if (preview) preview.textContent = currentSelectedEmoji;
      }
    });
  }

  // 3. Modal Form Submit
  const modalForm = document.getElementById('form-modal-add-leave-type');
  if (modalForm) {
    modalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('modal-input-type-name');
      const catInput = document.getElementById('modal-input-type-category');
      const colorSelect = document.getElementById('modal-select-type-color');

      const name = nameInput.value.trim();
      const category = (catInput ? catInput.value.trim() : '') || 'Custom';
      const color = colorSelect ? colorSelect.value : 'blue';
      const emoji = currentSelectedEmoji || '🏖️';

      if (!name) return;

      if (state.settings.leaveTypes.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        showToast('This leave type already exists!', 'error');
        return;
      }

      state.settings.leaveTypes.push({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name: name,
        color: color,
        category: category,
        icon: emoji
      });

      saveSettingsToStorage();
      closeModal();
      modalForm.reset();

      renderSettings();
      renderLeaveTracker();
      renderDashboard();

      showToast(`Added "${name}" ${emoji}! Dashboard & tracker updated in real time.`, 'success');
    });
  }

  // 4. Admin Auto-Year Progression Toggle
  const autoYearToggle = document.getElementById('toggle-auto-year-unlock');
  if (autoYearToggle) {
    autoYearToggle.addEventListener('change', (e) => {
      localStorage.setItem('leave_tracker_auto_year_unlock', e.target.checked);
      if (e.target.checked) {
        showToast('Automatic year progression enabled. Upcoming years unlock automatically.', 'success');
        renderLeaveTracker();
        renderSettings();
      } else {
        showToast('Automatic year progression disabled.', 'info');
      }
    });
  }

  // 5. Export & Import Handlers
  const exportBtn = document.getElementById('btn-export-data');
  if (exportBtn) exportBtn.addEventListener('click', handleExportPrompt);

  const importInput = document.getElementById('file-import-data');
  if (importInput) importInput.addEventListener('change', handleImportFile);
}
