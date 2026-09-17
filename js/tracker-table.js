/**
 * Tracker Section & Table Rows Renderer
 * Personal Leave Tracker
 */

import { state, generateId, getDayName, isWeekend, getLeaveColorClass, showToast, saveEntriesToStorage } from './state.js';
import { renderLeaveTracker } from './tracker.js';

export function renderYearSection(year) {
  const card = document.createElement('div');
  card.className = `year-card ${state.collapsedYears[year] ? 'collapsed' : ''}`;
  card.id = `year-section-${year}`;

  const rows = state.entries[year] || [];
  const activeCount = rows.filter(r => r.date || r.reason).length;

  const headerBar = document.createElement('div');
  headerBar.className = 'year-header-bar';
  headerBar.innerHTML = `
    <div class="year-header-left">
      <span class="year-toggle-chevron">▼</span>
      <div class="year-title">
        <span>📅 YEAR ${year}</span>
        <span class="year-entry-count-badge">${activeCount} ${activeCount === 1 ? 'entry' : 'entries'}</span>
      </div>
    </div>
    <div class="year-header-actions" onclick="event.stopPropagation();">
      <button type="button" class="btn-add-entry-quick"><span>➕ Add Entry</span></button>
    </div>
  `;

  headerBar.addEventListener('click', () => {
    state.collapsedYears[year] = !state.collapsedYears[year];
    card.classList.toggle('collapsed', state.collapsedYears[year]);
  });

  headerBar.querySelector('.btn-add-entry-quick').addEventListener('click', (e) => {
    e.stopPropagation();
    state.collapsedYears[year] = false;
    card.classList.remove('collapsed');
    addNewEntryToYear(year);
  });

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'year-table-wrapper';
  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width: 60px;" class="sortable text-center" data-col="sNo">
          <span class="th-content">S.No <span class="sort-indicator">${state.sort.column === 'sNo' ? (state.sort.direction === 'asc' ? '▲' : '▼') : '↕'}</span></span>
        </th>
        <th style="width: 180px;" class="sortable" data-col="date"><span class="th-content">Date 📅</span></th>
        <th style="width: 140px;" class="sortable" data-col="day"><span class="th-content">Day</span></th>
        <th style="width: 210px;" class="sortable" data-col="leaveType"><span class="th-content">Leave Type</span></th>
        <th class="sortable" data-col="reason"><span class="th-content">Reason / Purpose</span></th>
        <th style="width: 80px; text-align: center;">Action</th>
      </tr>
    </thead>
    <tbody id="year-tbody-${year}"></tbody>
  `;

  table.querySelectorAll('thead th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-col');
      state.sort.direction = state.sort.column === col && state.sort.direction === 'asc' ? 'desc' : 'asc';
      state.sort.column = col;
      renderLeaveTracker();
    });
  });

  populateYearTbody(year, table.querySelector('tbody'));
  tableWrapper.appendChild(table);

  const footer = document.createElement('div');
  footer.className = 'year-table-footer';
  footer.innerHTML = `
    <button type="button" class="btn btn-ghost btn-sm btn-footer-add"><span>➕ Add another leave record in ${year}</span></button>
    <span class="year-footer-meta">${activeCount} total records</span>
  `;
  footer.querySelector('.btn-footer-add').addEventListener('click', () => addNewEntryToYear(year));

  card.appendChild(headerBar);
  card.appendChild(tableWrapper);
  card.appendChild(footer);
  return card;
}

const editingRowIds = new Set();

export function formatDisplayDate(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

export function populateYearTbody(year, tbody) {
  tbody.innerHTML = '';
  const rawRows = state.entries[year] || [];

  const filtered = rawRows.filter(row => {
    if (state.filters.search) {
      const q = state.filters.search.toLowerCase();
      if (![row.reason, row.day, row.date, row.leaveType].some(v => (v || '').toLowerCase().includes(q))) return false;
    }
    if (state.filters.leaveType !== 'ALL' && (row.leaveType || '').toLowerCase() !== state.filters.leaveType.toLowerCase()) return false;
    if (state.filters.month !== 'ALL' && (!row.date || parseInt(row.date.split('-')[1], 10) !== parseInt(state.filters.month, 10))) return false;
    return true;
  });

  // Always keep S.No in clean ascending order
  const displayRows = [...filtered].sort((a, b) => {
    if (state.sort.column === 'sNo') {
      return state.sort.direction === 'asc' ? a.sNo - b.sNo : b.sNo - a.sNo;
    }
    let cmp = String(a[state.sort.column] || '').localeCompare(String(b[state.sort.column] || ''), undefined, { numeric: true });
    return state.sort.direction === 'asc' ? cmp : -cmp;
  });

  if (displayRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty-notice">No entries found. Click <strong>"+ Add Entry"</strong> to record a leave.</td></tr>`;
    return;
  }

  const allowPastYears = localStorage.getItem('leave_tracker_allow_past_years') === 'true';
  const minDate = allowPastYears ? '2000-01-01' : `${Math.max(2026, year)}-01-01`;
  const maxDate = `${year}-12-31`;

  displayRows.forEach(row => {
    const isEditing = editingRowIds.has(row.id);
    const tr = document.createElement('tr');
    tr.className = row.leaveType ? getLeaveColorClass(row.leaveType) : 'row-empty';
    tr.id = `row-${row.id}`;
    if (isEditing) tr.classList.add('row-is-editing');
    const dayWeekend = isWeekend(row.day);

    if (isEditing) {
      // EDIT MODE
      let typeOpts = '<option value="">-- Select Type --</option>';
      state.settings.leaveTypes.forEach(t => {
        typeOpts += `<option value="${t.name}" ${(row.leaveType || '').toLowerCase() === t.name.toLowerCase() ? 'selected' : ''}>${t.name}</option>`;
      });

      tr.innerHTML = `
        <td class="cell-sno"><span class="sno-badge">${row.sNo}</span></td>
        <td><input type="date" class="cell-input-date" value="${row.date || ''}" min="${minDate}" max="${maxDate}" aria-label="Leave Date"></td>
        <td><div class="day-cell ${dayWeekend ? 'weekend' : ''}">${row.day ? (dayWeekend ? '⚠️ ' + row.day : row.day) : '<span class="dash-empty">—</span>'}</div></td>
        <td><select class="cell-select-type" aria-label="Leave Type">${typeOpts}</select></td>
        <td><input type="text" class="cell-input-text" value="${(row.reason || '').replace(/"/g, '&quot;')}" placeholder="Reason or purpose..." aria-label="Reason"></td>
        <td class="cell-actions">
          <div class="row-actions-group">
            <button type="button" class="btn-icon btn-save" title="Save changes (💾)">💾</button>
            <button type="button" class="btn-icon btn-cancel" title="Cancel edit (✕)">✕</button>
          </div>
        </td>
      `;

      const dInput = tr.querySelector('.cell-input-date');
      const tSelect = tr.querySelector('.cell-select-type');
      const rInput = tr.querySelector('.cell-input-text');
      const dayCell = tr.querySelector('.day-cell');

      dInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const dName = getDayName(val);
        const isW = isWeekend(dName);
        dayCell.className = `day-cell ${isW ? 'weekend' : ''}`;
        dayCell.innerHTML = dName ? (isW ? '⚠️ ' + dName : dName) : '<span class="dash-empty">—</span>';
        if (val && !tSelect.value && state.settings.leaveTypes.length > 0) {
          tSelect.value = state.settings.leaveTypes[0].name;
        }
      });

      rInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          tr.querySelector('.btn-save').click();
        }
      });

      // Save Action
      tr.querySelector('.btn-save').addEventListener('click', () => {
        const newDate = dInput.value;
        const newType = tSelect.value;
        const newReason = rInput.value.trim();

        if (newDate) {
          row.date = newDate;
          row.day = getDayName(newDate);
        }
        if (newType) {
          row.leaveType = newType;
        }
        row.reason = newReason;

        editingRowIds.delete(row.id);
        saveEntriesToStorage();
        renderLeaveTracker();
        showToast(`Saved entry #${row.sNo}.`, 'success');
      });

      // Cancel Action
      tr.querySelector('.btn-cancel').addEventListener('click', () => {
        editingRowIds.delete(row.id);
        if (!row.date && !row.reason) {
          state.entries[year] = state.entries[year].filter(r => r.id !== row.id);
          state.entries[year].forEach((r, idx) => { r.sNo = idx + 1; });
          saveEntriesToStorage();
        }
        renderLeaveTracker();
      });

    } else {
      // VIEW MODE (Read-only, protected from accidental clicks)
      const matchedType = state.settings.leaveTypes.find(t => (t.name || '').toLowerCase() === (row.leaveType || '').toLowerCase());
      const typeColor = matchedType?.color || 'blue';

      tr.innerHTML = `
        <td class="cell-sno"><span class="sno-badge">${row.sNo}</span></td>
        <td>
          <div class="cell-display cell-display-date">
            <span>${formatDisplayDate(row.date)}</span>
            <span class="date-icon">📅</span>
          </div>
        </td>
        <td><div class="day-cell ${dayWeekend ? 'weekend' : ''}">${row.day ? (dayWeekend ? '⚠️ ' + row.day : row.day) : '<span class="dash-empty">—</span>'}</div></td>
        <td>
          <div class="cell-display cell-display-type">
            <span class="leave-type-pill" style="border-left: 3.5px solid var(--leave-${typeColor}-border, #4472C4);">${row.leaveType || '—'}</span>
          </div>
        </td>
        <td>
          <div class="cell-display cell-display-reason" title="${(row.reason || '').replace(/"/g, '&quot;')}">
            ${(row.reason || '').replace(/"/g, '&quot;') || '<span class="dash-empty">—</span>'}
          </div>
        </td>
        <td class="cell-actions">
          <div class="row-actions-group">
            <button type="button" class="btn-icon btn-edit" title="Edit entry (✏️)">✏️</button>
            <button type="button" class="btn-icon btn-delete" title="Delete entry (🗑️)">🗑️</button>
          </div>
        </td>
      `;

      tr.querySelector('.btn-edit').addEventListener('click', () => {
        editingRowIds.add(row.id);
        renderLeaveTracker();
        setTimeout(() => {
          const activeRow = document.getElementById(`row-${row.id}`);
          if (activeRow) {
            const dateInp = activeRow.querySelector('.cell-input-date');
            if (dateInp) {
              dateInp.focus();
              try { dateInp.showPicker(); } catch (_) {}
            }
          }
        }, 50);
      });

      tr.querySelector('.btn-delete').addEventListener('click', () => deleteRow(year, row.id));
    }

    tbody.appendChild(tr);
  });
}

export function addNewEntryToYear(year) {
  if (!state.entries[year]) state.entries[year] = [];
  const rows = state.entries[year];

  // S.No strictly in ascending order: rows.length + 1
  const newEntry = {
    id: generateId(),
    sNo: rows.length + 1,
    date: '',
    day: '',
    leaveType: state.settings.leaveTypes[0]?.name || 'Leave',
    reason: ''
  };

  rows.push(newEntry);
  editingRowIds.add(newEntry.id);
  saveEntriesToStorage();
  renderLeaveTracker();

  setTimeout(() => {
    const el = document.getElementById(`row-${newEntry.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const inp = el.querySelector('.cell-input-date');
      if (inp) { inp.focus(); try { inp.showPicker(); } catch (_) {} }
    }
  }, 100);

  showToast(`Added entry #${newEntry.sNo}. Edit details and click 💾 to save.`, 'info');
}

export function deleteRow(year, rowId) {
  if (!confirm('Are you sure you want to delete this record?')) return;
  editingRowIds.delete(rowId);
  state.entries[year] = (state.entries[year] || []).filter(r => r.id !== rowId);
  // Re-number strictly in ascending order: 1, 2, 3...
  state.entries[year].forEach((r, idx) => { r.sNo = idx + 1; });
  saveEntriesToStorage();
  renderLeaveTracker();
  showToast('Record deleted.', 'info');
}
