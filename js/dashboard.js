/**
 * Dashboard Analytics & Summary Matrix
 * Personal Leave Tracker
 */

import { state } from './state.js';
import { MONTH_NAMES } from '../config.js';
import { renderSettings } from './settings.js';

export function renderDashboard() {
  populateDashboardYearSelect();
  renderSummaryTable();
  renderQuickMetricTiles();
  renderMonthMatrix();
  renderSettings();
}

export function populateDashboardYearSelect() {
  const select = document.getElementById('dashboard-year-select');
  if (!select) return;
  const curVal = state.dashboardYear;
  select.innerHTML = '<option value="ALL">All Years</option>';
  state.settings.years.slice().sort((a, b) => b - a).forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `Year ${y}`;
    select.appendChild(opt);
  });
  if (select.querySelector(`option[value="${curVal}"]`)) {
    select.value = curVal;
  }
}

export function setupDashboardEvents() {
  const select = document.getElementById('dashboard-year-select');
  if (select) {
    select.addEventListener('change', (e) => {
      state.dashboardYear = e.target.value;
      renderDashboard();
    });
  }
}

function getFilteredEntriesForDashboard() {
  const selectedYear = state.dashboardYear;
  let list = [];
  if (selectedYear === 'ALL') {
    Object.keys(state.entries).forEach(y => {
      list = list.concat((state.entries[y] || []).filter(r => r.date && r.leaveType));
    });
  } else {
    list = (state.entries[selectedYear] || []).filter(r => r.date && r.leaveType);
  }
  return list;
}

function renderSummaryTable() {
  const tbody = document.getElementById('summary-table-body');
  const totalElem = document.getElementById('summary-total-count');
  const scopeBadge = document.getElementById('summary-scope-badge');
  if (!tbody) return;

  scopeBadge.textContent = state.dashboardYear === 'ALL' ? 'All Years' : `Year ${state.dashboardYear}`;

  const entries = getFilteredEntriesForDashboard();
  const total = entries.length;

  const counts = {};
  state.settings.leaveTypes.forEach(t => { counts[t.name.toLowerCase()] = 0; });
  entries.forEach(r => {
    const k = (r.leaveType || '').toLowerCase();
    counts[k] = (counts[k] || 0) + 1;
  });

  tbody.innerHTML = '';
  state.settings.leaveTypes.forEach(t => {
    const c = counts[t.name.toLowerCase()] || 0;
    const prop = total > 0 ? Math.round((c / total) * 100) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="summary-pill row-leave-${t.color || 'blue'}">
          <span class="summary-dot" style="background-color: currentColor;"></span>
          ${t.name}
        </span>
      </td>
      <td style="color: var(--text-muted); font-size: 0.85rem;">${t.category || 'General'}</td>
      <td class="text-right" style="font-family: var(--font-mono); font-weight: 700; font-size: 1rem;">${c}</td>
      <td class="text-right" style="font-family: var(--font-mono); font-weight: 600;">
        <div class="progress-bar-inline">
          <div class="progress-fill" style="width: ${prop}%;"></div>
          <span>${prop}%</span>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (totalElem) totalElem.textContent = total;
}

function renderQuickMetricTiles() {
  const entries = getFilteredEntriesForDashboard();
  const leaveC = entries.filter(r => (r.leaveType || '').toLowerCase() === 'leave').length;
  const wfhC = entries.filter(r => (r.leaveType || '').toLowerCase() === 'work from home').length;
  const sickC = entries.filter(r => (r.leaveType || '').toLowerCase() === 'sick leave').length;

  const lEl = document.getElementById('metric-leave-count');
  const wEl = document.getElementById('metric-wfh-count');
  const sEl = document.getElementById('metric-sick-count');
  if (lEl) lEl.textContent = leaveC;
  if (wEl) wEl.textContent = wfhC;
  if (sEl) sEl.textContent = sickC;
}

function renderMonthMatrix() {
  const thead = document.getElementById('month-breakdown-thead');
  const tbody = document.getElementById('month-breakdown-tbody');
  const tfoot = document.getElementById('month-breakdown-tfoot');
  const tag = document.getElementById('breakdown-year-tag');
  if (!thead || !tbody) return;

  tag.textContent = state.dashboardYear === 'ALL' ? 'Aggregated Across All Years' : `Year ${state.dashboardYear}`;

  const entries = getFilteredEntriesForDashboard();
  const leaveTypes = state.settings.leaveTypes;

  let thHtml = '<tr><th style="width: 140px;">Month</th>';
  leaveTypes.forEach(t => { thHtml += `<th class="text-center">${t.name}</th>`; });
  thHtml += '<th class="text-right" style="width: 100px;">Total</th></tr>';
  thead.innerHTML = thHtml;

  const matrix = [];
  for (let m = 0; m < 12; m++) {
    const rowData = { month: MONTH_NAMES[m], counts: {}, total: 0 };
    leaveTypes.forEach(t => { rowData.counts[t.name.toLowerCase()] = 0; });
    matrix.push(rowData);
  }

  const colTotals = {};
  leaveTypes.forEach(t => { colTotals[t.name.toLowerCase()] = 0; });
  let grandTotal = 0;

  entries.forEach(r => {
    if (!r.date) return;
    const mNum = parseInt(r.date.split('-')[1], 10) - 1;
    if (mNum >= 0 && mNum < 12) {
      const typeKey = (r.leaveType || '').toLowerCase();
      if (matrix[mNum].counts[typeKey] !== undefined) {
        matrix[mNum].counts[typeKey]++;
        matrix[mNum].total++;
        colTotals[typeKey]++;
        grandTotal++;
      }
    }
  });

  tbody.innerHTML = '';
  matrix.forEach(row => {
    const tr = document.createElement('tr');
    let trHtml = `<td><strong>${row.month}</strong></td>`;
    leaveTypes.forEach(t => {
      const c = row.counts[t.name.toLowerCase()] || 0;
      trHtml += `<td class="text-center"><span class="matrix-cell-count ${c > 0 ? 'has-leaves' : ''}">${c > 0 ? c : '—'}</span></td>`;
    });
    trHtml += `<td class="text-right" style="font-weight: 700; font-family: var(--font-mono);">${row.total}</td>`;
    tr.innerHTML = trHtml;
    tbody.appendChild(tr);
  });

  let tfHtml = '<tr class="total-row"><td><strong>TOTAL</strong></td>';
  leaveTypes.forEach(t => {
    const tot = colTotals[t.name.toLowerCase()] || 0;
    tfHtml += `<td class="text-center"><strong>${tot}</strong></td>`;
  });
  tfHtml += `<td class="text-right"><strong>${grandTotal}</strong></td></tr>`;
  tfoot.innerHTML = tfHtml;
}
