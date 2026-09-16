/**
 * ===================================================
 * USER CONFIGURATION & CREDENTIALS
 * ===================================================
 * Easily update your login credentials, display name,
 * default leave types, and seed data here dynamically.
 */

// 1. User Credentials & Profile
export const USER_CONFIG = {
  username: 'Nisanth',
  password: 'Nisanth@2001',
  displayName: 'Nisanth',
  appName: 'Personal Leave Tracker'
};

// 2. Storage Keys Configuration
export const STORAGE_KEYS = {
  SESSION_AUTH: 'leave_tracker_auth_session_v2',
  SETTINGS: 'leave_tracker_settings_v2',
  ENTRIES: 'leave_tracker_entries_v2'
};

// 3. Default Leave Categories & Colors
export const DEFAULT_LEAVE_TYPES = [
  { id: 'leave', name: 'Leave', color: 'red', category: 'Annual / Vacation' },
  { id: 'wfh', name: 'Work From Home', color: 'green', category: 'Remote Working' },
  { id: 'sick', name: 'Sick Leave', color: 'yellow', category: 'Medical' }
];

// 4. Initial Active Tracking Years
export const DEFAULT_YEARS = [2026];

// 5. Date & Calendar Reference
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

// 6. Pre-seeded Leave Records
export const SEED_ENTRIES_2026 = [
  { date: '2026-01-02', leaveType: 'Leave', reason: 'Travel to hometown for personal commitments' },
  { date: '2026-01-14', leaveType: 'Work From Home', reason: 'Working remotely due to being in hometown for Pongal festival' },
  { date: '2026-01-16', leaveType: 'Leave', reason: 'Personal leave for family commitments after Pongal travel' },
  { date: '2026-03-18', leaveType: 'Work From Home', reason: 'Not feeling well due to stomach upset' },
  { date: '2026-03-20', leaveType: 'Work From Home', reason: 'Due to Cold and Cough' },
  { date: '2026-04-13', leaveType: 'Leave', reason: 'Personal commitment' },
  { date: '2026-05-08', leaveType: 'Sick Leave', reason: 'Headache and cold' },
  { date: '2026-05-20', leaveType: 'Work From Home', reason: 'Leg pain and swelling' },
  { date: '2026-06-01', leaveType: 'Work From Home', reason: 'Temple festival in hometown' },
  { date: '2026-08-04', leaveType: 'Sick Leave', reason: 'Due to Throat pain and Cold' },
  { date: '2026-08-05', leaveType: 'Work From Home', reason: 'Due to Throat pain and Cold' },
  { date: '2026-08-14', leaveType: 'Leave', reason: 'Hospital Checkup' },
  { date: '2026-08-27', leaveType: 'Sick Leave', reason: 'Due to Fever' },
  { date: '2026-08-28', leaveType: 'Work From Home', reason: 'Due to Fever' },
  { date: '2026-08-31', leaveType: 'Leave', reason: 'Arun Kumar Marriage' },
  { date: '2026-09-21', leaveType: 'Work From Home', reason: 'Family Function' }
];

// 7. Export / Import Column Schema (Excel / CSV)
export const CSV_COLUMNS = ['S.No', 'Date', 'Day', 'Leave Type', 'Reason', 'Year'];
