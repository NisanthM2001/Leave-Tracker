/**
 * ===================================================
 * APPLICATION CONFIGURATION & SCHEMA CONSTANTS
 * ===================================================
 * All user credentials and leave entries are persisted
 * in the Neon PostgreSQL Database.
 */

// 1. Storage Keys Configuration (Client Session)
export const STORAGE_KEYS = {
  SESSION_AUTH: 'leave_tracker_auth_session_v2',
  SESSION_TOKEN: 'leave_tracker_auth_token_v2',
  CURRENT_USER: 'leave_tracker_current_user_v2',
  SETTINGS: 'leave_tracker_settings_v2',
  ENTRIES: 'leave_tracker_entries_v2'
};

// 2. Default Leave Categories & Colors
export const DEFAULT_LEAVE_TYPES = [
  { id: 'leave', name: 'Leave', color: 'red', category: 'Annual / Vacation' },
  { id: 'wfh', name: 'Work From Home', color: 'green', category: 'Remote Working' },
  { id: 'sick', name: 'Sick Leave', color: 'yellow', category: 'Medical' }
];

// 3. Initial Active Tracking Years
export const DEFAULT_YEARS = [2026];

// 4. Date & Calendar Reference
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

// 5. Export / Import Column Schema (Excel / CSV)
export const CSV_COLUMNS = ['S.No', 'Date', 'Day', 'Leave Type', 'Reason', 'Year'];
