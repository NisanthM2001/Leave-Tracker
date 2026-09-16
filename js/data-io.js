/**
 * Data Import & Export (Excel CSV and JSON)
 * Personal Leave Tracker
 */

import { state, showToast, saveSettingsToStorage, saveEntriesToStorage, normalizeData, getDayName, generateId } from './state.js';
import { CSV_COLUMNS, USER_CONFIG } from '../config.js';
import { renderLeaveTracker } from './tracker.js';
import { renderSettings } from './settings.js';

export function handleExportPrompt() {
  const choice = prompt(
    "Choose Export Format:\n" +
    "1: Excel Spreadsheet (CSV)\n" +
    "2: Full Backup (JSON - Entries + Settings + User Profile)\n" +
    "3: Leave Entries Only (JSON)",
    "1"
  );
  if (!choice) return;
  if (choice.trim() === '1') {
    exportAsExcelCSV();
  } else if (choice.trim() === '2') {
    exportFullBackupJSON();
  } else if (choice.trim() === '3') {
    exportEntriesOnlyJSON();
  } else {
    showToast('Invalid choice. Please choose 1, 2, or 3.', 'error');
  }
}

function exportAsExcelCSV() {
  let csv = '\uFEFF' + CSV_COLUMNS.join(',') + '\n';
  const years = state.settings.years.slice().sort((a, b) => a - b);

  years.forEach(year => {
    const rows = state.entries[year] || [];
    rows.forEach(r => {
      const reasonEscaped = `"${(r.reason || '').replace(/"/g, '""')}"`;
      csv += `${r.sNo},${r.date || ''},${r.day || ''},${r.leaveType || ''},${reasonEscaped},${year}\n`;
    });
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `leave_tracker_${new Date().toISOString().slice(0, 10)}.csv`);
  showToast('Excel (CSV) file downloaded!', 'success');
}

function exportFullBackupJSON() {
  const exportObj = {
    app: 'Personal Leave Tracker',
    exportDate: new Date().toISOString(),
    userProfile: {
      username: USER_CONFIG.username,
      displayName: USER_CONFIG.displayName
    },
    settings: state.settings,
    entries: state.entries
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `leave_tracker_full_backup_${new Date().toISOString().slice(0, 10)}.json`);
  showToast('Full JSON backup downloaded!', 'success');
}

function exportEntriesOnlyJSON() {
  const exportObj = {
    app: 'Personal Leave Tracker',
    exportDate: new Date().toISOString(),
    entries: state.entries
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `leave_entries_${new Date().toISOString().slice(0, 10)}.json`);
  showToast('Entries JSON file downloaded!', 'success');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  const reader = new FileReader();

  if (fileName.endsWith('.json')) {
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (imported.settings && imported.entries) {
          state.settings = imported.settings;
          state.entries = imported.entries;
          normalizeData();
          saveSettingsToStorage();
          saveEntriesToStorage();
          renderSettings();
          renderLeaveTracker();
          showToast('JSON Data imported successfully!', 'success');
        } else {
          showToast('Invalid JSON backup file structure.', 'error');
        }
      } catch (err) {
        showToast('Failed to parse JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  } else if (fileName.endsWith('.csv')) {
    reader.onload = (evt) => {
      try {
        parseCSVAndImport(evt.target.result);
      } catch (err) {
        showToast('Failed to parse Excel/CSV file.', 'error');
      }
    };
    reader.readAsText(file);
  } else {
    showToast('Unsupported file type. Please choose .json or .csv', 'error');
  }

  e.target.value = '';
}

function parseCSVAndImport(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    showToast('CSV file is empty or missing data rows.', 'error');
    return;
  }

  let count = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length >= 4) {
      const date = cols[1]?.trim() || '';
      const leaveType = cols[3]?.trim() || 'Leave';
      const reason = cols[4]?.trim() || '';
      let year = cols[5] ? parseInt(cols[5].trim(), 10) : (date ? parseInt(date.split('-')[0], 10) : 2026);

      if (!isNaN(year) && date) {
        if (!state.settings.years.includes(year)) state.settings.years.push(year);
        if (!state.entries[year]) state.entries[year] = [];

        state.entries[year].push({
          id: generateId(),
          sNo: state.entries[year].length + 1,
          date: date,
          day: getDayName(date),
          leaveType: leaveType,
          reason: reason
        });
        count++;
      }
    }
  }

  normalizeData();
  saveSettingsToStorage();
  saveEntriesToStorage();
  renderSettings();
  renderLeaveTracker();
  showToast(`Successfully imported ${count} records from Excel/CSV!`, 'success');
}

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}
