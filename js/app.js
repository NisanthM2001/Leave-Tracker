/**
 * Main Application Bootstrap
 * Personal Leave Tracker
 */

import { loadFromStorage, updateGlobalBadges } from './state.js';
import { setupAuthEvents, checkAuth } from './auth.js';
import { initYearCollapseState, renderLeaveTracker, setupTrackerToolbarEvents } from './tracker.js';
import { renderDashboard, setupDashboardEvents } from './dashboard.js';
import { setupSettingsForms } from './settings.js';

function initApp() {
  loadFromStorage();
  initYearCollapseState();
  renderLeaveTracker();
  renderDashboard();
  updateGlobalBadges();
}

function setupTabNavigation() {
  const trackerTab = document.getElementById('tab-btn-tracker');
  const dashboardTab = document.getElementById('tab-btn-dashboard');
  const trackerPanel = document.getElementById('view-tracker');
  const dashboardPanel = document.getElementById('view-dashboard');

  if (trackerTab && dashboardTab) {
    trackerTab.addEventListener('click', () => {
      trackerTab.classList.add('active');
      trackerTab.setAttribute('aria-selected', 'true');
      dashboardTab.classList.remove('active');
      dashboardTab.setAttribute('aria-selected', 'false');

      trackerPanel.classList.remove('hidden');
      dashboardPanel.classList.add('hidden');
      renderLeaveTracker();
    });

    dashboardTab.addEventListener('click', () => {
      dashboardTab.classList.add('active');
      dashboardTab.setAttribute('aria-selected', 'true');
      trackerTab.classList.remove('active');
      trackerTab.setAttribute('aria-selected', 'false');

      dashboardPanel.classList.remove('hidden');
      trackerPanel.classList.add('hidden');
      renderDashboard();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupAuthEvents(initApp);
  setupTabNavigation();
  setupTrackerToolbarEvents();
  setupDashboardEvents();
  setupSettingsForms();
  checkAuth(initApp);
});
