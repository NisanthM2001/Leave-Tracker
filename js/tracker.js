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

export function renderLeaveTracker() {
  populateFilterDropdowns();
  renderAllYearSections();
  updateNextYearPrompt();
}

function updateNextYearPrompt() {
  const maxYear = state.settings.years.length > 0 ? Math.max(...state.settings.years) : 2026;
  const nextYear = maxYear + 1;
  const btn = document.getElementById('btn-add-next-year-top');
  if (btn) {
    btn.innerHTML = `<span>➕ Start Year ${nextYear}</span>`;
    btn.title = `Add and open Year ${nextYear} for leave recording`;
  }
}

export function populateFilterDropdowns() {
  const typeFilter = document.getElementById('filter-leave-type');
  if (typeFilter) {
    const prev = typeFilter.value;
    typeFilter.innerHTML = '<option value="ALL">All Types</option>';
    state.settings.leaveTypes.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.name;
      opt.textContent = t.name;
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

  // Next Year Banner
  const maxYear = state.settings.years.length > 0 ? Math.max(...state.settings.years) : 2026;
  const nextYear = maxYear + 1;
  const banner = document.createElement('div');
  banner.className = 'next-year-banner card';
  banner.innerHTML = `
    <div class="next-year-content">
      <div class="next-year-icon">🚀</div>
      <div class="next-year-text">
        <h4>Completed Year ${maxYear} or planning ahead?</h4>
        <p>Instantly unlock <strong>Year ${nextYear}</strong>. No limits — continue tracking as far as you go!</p>
      </div>
    </div>
    <button type="button" class="btn btn-primary" id="btn-banner-add-year">
      <span>+ Add Year ${nextYear}</span>
    </button>
  `;
  banner.querySelector('#btn-banner-add-year').addEventListener('click', () => addNewYear(nextYear));
  container.appendChild(banner);
}

export function addNewYear(targetYear) {
  const yearToAdd = targetYear || ((state.settings.years.length > 0 ? Math.max(...state.settings.years) : 2026) + 1);
  if (state.settings.years.includes(yearToAdd)) {
    showToast(`Year ${yearToAdd} already exists!`, 'error');
    return;
  }
  state.settings.years.push(yearToAdd);
  state.settings.years.sort((a, b) => a - b);
  state.entries[yearToAdd] = [];
  state.collapsedYears[yearToAdd] = false;
  saveSettingsToStorage();
  saveEntriesToStorage();
  renderLeaveTracker();
  addNewEntryToYear(yearToAdd);
  showToast(`Year ${yearToAdd} added!`, 'success');
}

export function setupTrackerToolbarEvents() {
  const addTop = document.getElementById('btn-add-next-year-top');
  if (addTop) addTop.addEventListener('click', () => addNewYear());

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
