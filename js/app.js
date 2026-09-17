/**
 * Main Application Bootstrap (Neon PostgreSQL Connected)
 * Personal Leave Tracker
 */

import { loadFromStorage, updateGlobalBadges } from './state.js';
import { setupAuthEvents, checkAuth, getCurrentUser } from './auth.js';
import { initYearCollapseState, renderLeaveTracker, setupTrackerToolbarEvents } from './tracker.js';
import { renderDashboard, setupDashboardEvents } from './dashboard.js';
import { setupSettingsForms } from './settings.js';
import { renderUserManagement, setupUsersEvents } from './users.js';

async function initApp() {
  await loadFromStorage();
  initYearCollapseState();
  renderLeaveTracker();
  renderDashboard();
  updateGlobalBadges();

  const user = getCurrentUser();
  if (user && user.isAdmin) {
    renderUserManagement();
  }
}

function setupTabNavigation() {
  const trackerTab = document.getElementById('tab-btn-tracker');
  const dashboardTab = document.getElementById('tab-btn-dashboard');
  const usersTab = document.getElementById('tab-btn-users');

  const trackerPanel = document.getElementById('view-tracker');
  const dashboardPanel = document.getElementById('view-dashboard');
  const usersPanel = document.getElementById('view-users');

  function switchTab(activeBtn, activePanel) {
    [trackerTab, dashboardTab, usersTab].forEach(btn => {
      if (!btn) return;
      const isActive = btn === activeBtn;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    [trackerPanel, dashboardPanel, usersPanel].forEach(panel => {
      if (!panel) return;
      panel.classList.toggle('hidden', panel !== activePanel);
    });
  }

  if (trackerTab) {
    trackerTab.addEventListener('click', () => {
      switchTab(trackerTab, trackerPanel);
      renderLeaveTracker();
    });
  }

  if (dashboardTab) {
    dashboardTab.addEventListener('click', () => {
      switchTab(dashboardTab, dashboardPanel);
      renderDashboard();
    });
  }

  if (usersTab) {
    usersTab.addEventListener('click', () => {
      switchTab(usersTab, usersPanel);
      renderUserManagement();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupAuthEvents(initApp);
  setupTabNavigation();
  setupTrackerToolbarEvents();
  setupDashboardEvents();
  setupSettingsForms();
  setupUsersEvents();
  checkAuth(initApp);
});
