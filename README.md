# 📅 Personal Leave Tracker

A responsive, single-user Personal Leave Tracker web application with a spreadsheet-style dual-sheet interface, dynamic annual progression ("up to go", no arbitrary year limits), auto-calculated day fields, customizable leave categories, and analytics dashboards.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)

---

## ✨ Features

- **🔐 Private Login Gate**: Clean glassmorphism card, password reveal toggle, client-side session gate. Credentials easily updated in `config.js`.
- **📋 Dual-Tab Spreadsheet Shell**: Spreadsheet-styled tabs ("Leave Tracker" and "Dashboard") with live badge counters.
- **🚀 Dynamic Annual Progression ("Up to go")**: Starts with active tracking years (pre-seeded 2026). Start new years (2027, 2028, etc.) dynamically with no arbitrary limits.
- **📅 Auto-Calculated Day of Week**: Auto-determines the day from the native date picker; highlights weekend entries (`Saturday` / `Sunday`) with soft warning tags.
- **🎨 Leave Type Color Coding**: Soft red for Leave, soft green for Work From Home, soft yellow for Sick Leave, and customizable tints for custom categories.
- **🔍 Excel-Style AutoFilter**: Search reasons in real-time, filter by Leave Type, filter by Month, filter/jump by Year, and sort columns in ascending/descending order.
- **📈 Analytics Dashboard**: Live summary counts, percentage proportions, month-wise breakdown matrix (Jan–Dec vs categories), and quick metric tiles.
- **⚙️ Settings & Configuration**: Add/remove custom leave types and active tracking years (with confirmation warning before removal).
- **💾 Dual Import & Export**: Export as Excel (CSV with UTF-8 BOM) or JSON backup; import from `.csv` or `.json` with automatic day derivation and sequential ascending `S.No`.
- **🧱 Modular Architecture**: Clean separation of concerns where every single file is strictly under 300 lines.

---

## 📁 Project Structure

```
Leave-Tracker/
├── config.js              # User credentials, profile, defaults & seed data
├── index.html             # Main web application structure
├── style.css              # Master CSS manifest
├── app.js                 # ES module entry point
├── server.js              # Lightweight zero-dependency dev server
│
├── css/
│   ├── base.css           # Design tokens, login card, top nav & sheet tabs
│   ├── tracker.css        # AutoFilter toolbar, table styles & row highlights
│   └── dashboard.css      # Analytics summary, month matrix & toasts
│
└── js/
    ├── app.js             # Bootstrap & sheet tab switcher
    ├── auth.js            # Login gate & session handling
    ├── state.js           # Reactive state & localStorage persistence
    ├── tracker.js         # AutoFilter toolbar & year coordinator
    ├── tracker-table.js   # Table rendering & S.No ascending order
    ├── dashboard.js       # Analytics summary & month matrix
    ├── settings.js        # Settings & year removal warnings
    └── data-io.js         # Excel (CSV) and JSON dynamic export & import
```

---

## 🚀 Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/NisanthM2001/Leave-Tracker.git
   cd Leave-Tracker
   ```

2. **Start the local server**:
   ```bash
   node server.js
   ```

3. **Open in browser**:
   Navigate to `http://localhost:4173`

Or simply open `index.html` directly in any modern web browser!

---

## ⚙️ Configuration & Credentials

Open `config.js` to change:
- Login username and password
- Display name
- Default categories and highlight colors
- Initial pre-seeded records
