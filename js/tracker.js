/**
 * Leave Tracker Sheet Coordinator & AutoFilter Toolbar
 * Personal Leave Tracker
 */

import { state, showToast, saveEntriesToStorage, saveSettingsToStorage } from './state.js';
import { renderYearSection, addNewEntryToYear } from './tracker-table.js';

export function initYearCollapseState() {
  state.settings.years.forEach(year => {
    if (state.collapsedYears[year] === undefined) {
      const hasData = (state.entries[year] || []).length > 0;
      state.collapsedYears[year] = !hasData;
    }
  });
}

export function checkAutoYearProgression() {
  const isAutoUnlock = localStorage.getItem('leave_tracker_auto_year_unlock') !== 'false';
  if (!isAutoUnlock) return;

  const currentYear = new Date().getFullYear();
  if (currentYear >= 2026 && !state.settings.years.includes(currentYear)) {
    state.settings.years.push(currentYear);
    state.settings.years.sort((a, b) => a - b);
    if (!state.entries[currentYear]) {
      state.entries[currentYear] = [];
    }
    saveSettingsToStorage();
    saveEntriesToStorage();
  }
}

export function renderLeaveTracker() {
  checkAutoYearProgression();
  populateFilterDropdowns();
  renderAllYearSections();
}

export function populateFilterDropdowns() {
  const typeFilter = document.getElementById('filter-leave-type');
  if (typeFilter) {
    const prev = typeFilter.value;
    typeFilter.innerHTML = '<option value="ALL">All Types</option>';
    state.settings.leaveTypes.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.name;
      opt.textContent = `${t.icon ? t.icon + ' ' : ''}${t.name}`;
      typeFilter.appendChild(opt);
    });
    if (state.settings.leaveTypes.some(t => t.name === prev) || prev === 'ALL') {
      typeFilter.value = prev;
    }
  }

  const yearFilter = document.getElementById('filter-year-section');
  if (yearFilter) {
    const prevY = yearFilter.value;
    yearFilter.innerHTML = '<option value="ALL">All Years</option>';
    state.settings.years.slice().sort((a, b) => b - a).forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `Year ${y}`;
      yearFilter.appendChild(opt);
    });
    if (yearFilter.querySelector(`option[value="${prevY}"]`)) {
      yearFilter.value = prevY;
    }
  }
}

export function renderAllYearSections() {
  const container = document.getElementById('years-container');
  if (!container) return;
  container.innerHTML = '';

  const yearsSorted = state.settings.years.slice().sort((a, b) => a - b);
  const selectedYearFilter = state.filters.year;

  yearsSorted.forEach(year => {
    if (selectedYearFilter !== 'ALL' && String(year) !== String(selectedYearFilter)) return;
    container.appendChild(renderYearSection(year));
  });
}

export function setupTrackerToolbarEvents() {
  const search = document.getElementById('filter-search-reason');
  if (search) search.addEventListener('input', (e) => { state.filters.search = e.target.value.trim(); renderAllYearSections(); });

  const typeF = document.getElementById('filter-leave-type');
  if (typeF) typeF.addEventListener('change', (e) => { state.filters.leaveType = e.target.value; renderAllYearSections(); });

  const monthF = document.getElementById('filter-month');
  if (monthF) monthF.addEventListener('change', (e) => { state.filters.month = e.target.value; renderAllYearSections(); });

  const yearF = document.getElementById('filter-year-section');
  if (yearF) yearF.addEventListener('change', (e) => { state.filters.year = e.target.value; renderAllYearSections(); });

  const resetBtn = document.getElementById('btn-reset-filters');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    state.filters = { search: '', leaveType: 'ALL', month: 'ALL', year: 'ALL' };
    state.sort = { column: 'sNo', direction: 'asc' };
    if (search) search.value = '';
    if (typeF) typeF.value = 'ALL';
    if (monthF) monthF.value = 'ALL';
    if (yearF) yearF.value = 'ALL';
    renderLeaveTracker();
    showToast('Filters reset.', 'info');
  });

  const expAll = document.getElementById('btn-expand-all');
  if (expAll) expAll.addEventListener('click', () => {
    state.settings.years.forEach(y => { state.collapsedYears[y] = false; });
    document.querySelectorAll('.year-card').forEach(c => c.classList.remove('collapsed'));
  });

  const colAll = document.getElementById('btn-collapse-all');
  if (colAll) colAll.addEventListener('click', () => {
    state.settings.years.forEach(y => { state.collapsedYears[y] = true; });
    document.querySelectorAll('.year-card').forEach(c => c.classList.add('collapsed'));
  });
}
