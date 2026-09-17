const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool, initDatabase, DEFAULT_LEAVE_TYPES, getDayName } = require('./db.js');

const PORT = process.env.PORT || 4173;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Request Helpers
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end(JSON.stringify(data));
}

// Authentication Middleware
async function authenticateRequest(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  try {
    const result = await pool.query(`
      SELECT s.token, u.id, u.username, u.display_name, u.is_admin
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = $1
    `, [token]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      isAdmin: row.is_admin === true
    };
  } catch (err) {
    console.error('Session lookup error:', err);
    return null;
  }
}

// Route Handler
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const method = req.method.toUpperCase();

  // API Routes
  if (pathname.startsWith('/api/')) {
    try {
      // 1. Health & DB Status
      if (pathname === '/api/health' && method === 'GET') {
        const start = Date.now();
        const dbRes = await pool.query('SELECT NOW() as time');
        const latencyMs = Date.now() - start;
        return sendJson(res, 200, {
          status: 'ok',
          database: 'connected',
          provider: 'Neon PostgreSQL',
          latencyMs,
          serverTime: dbRes.rows[0].time
        });
      }

      // 2. Auth: Login
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { username, password } = body;

        if (!username || !password) {
          return sendJson(res, 400, { success: false, error: 'Username and password required' });
        }

        const userCheck = await pool.query(`
          SELECT id, username, display_name, password, is_admin
          FROM users
          WHERE LOWER(username) = LOWER($1)
        `, [username.trim()]);

        if (userCheck.rows.length === 0) {
          return sendJson(res, 401, { success: false, error: 'Invalid username or password' });
        }

        const user = userCheck.rows[0];
        if (user.password !== password) {
          return sendJson(res, 401, { success: false, error: 'Invalid username or password' });
        }

        // Generate session token
        const token = crypto.randomUUID();
        await pool.query(`
          INSERT INTO user_sessions (token, user_id)
          VALUES ($1, $2)
        `, [token, user.id]);

        return sendJson(res, 200, {
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            isAdmin: user.is_admin === true
          }
        });
      }

      // 3. Auth: Current User Check (/api/auth/me)
      if (pathname === '/api/auth/me' && method === 'GET') {
        const user = await authenticateRequest(req);
        if (!user) {
          return sendJson(res, 401, { success: false, error: 'Unauthorized' });
        }
        return sendJson(res, 200, { success: true, user });
      }

      // 4. Auth: Logout
      if (pathname === '/api/auth/logout' && method === 'POST') {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7).trim();
          await pool.query(`DELETE FROM user_sessions WHERE token = $1`, [token]);
        }
        return sendJson(res, 200, { success: true });
      }

      // Authenticate all remaining API endpoints
      const user = await authenticateRequest(req);
      if (!user) {
        return sendJson(res, 401, { success: false, error: 'Unauthorized. Please sign in.' });
      }

      // 5. Data: Load Entries & Settings
      if (pathname === '/api/data' && method === 'GET') {
        // Load Settings
        let settingsRes = await pool.query(`
          SELECT years, leave_types
          FROM user_settings
          WHERE user_id = $1
        `, [user.id]);

        let settings = {
          years: [2026],
          leaveTypes: DEFAULT_LEAVE_TYPES
        };

        if (settingsRes.rows.length > 0) {
          settings.years = settingsRes.rows[0].years || [2026];
          settings.leaveTypes = settingsRes.rows[0].leave_types || DEFAULT_LEAVE_TYPES;
        } else {
          // Initialize default settings for user
          await pool.query(`
            INSERT INTO user_settings (user_id, years, leave_types)
            VALUES ($1, $2, $3)
          `, [user.id, JSON.stringify([2026]), JSON.stringify(DEFAULT_LEAVE_TYPES)]);
        }

        // Load Entries
        const entriesRes = await pool.query(`
          SELECT id, year, s_no, date, day, leave_type, reason
          FROM leave_entries
          WHERE user_id = $1
          ORDER BY year ASC, s_no ASC
        `, [user.id]);

        const entries = {};
        // Initialize years in entries object
        settings.years.forEach(y => { entries[y] = []; });

        entriesRes.rows.forEach(row => {
          if (!entries[row.year]) entries[row.year] = [];
          entries[row.year].push({
            id: row.id,
            sNo: row.s_no,
            date: row.date || '',
            day: row.day || (row.date ? getDayName(row.date) : ''),
            leaveType: row.leave_type || '',
            reason: row.reason || ''
          });
        });

        return sendJson(res, 200, {
          success: true,
          settings,
          entries
        });
      }

      // 6. Data: Sync Entries
      if (pathname === '/api/entries/sync' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { entries } = body;

        if (!entries || typeof entries !== 'object') {
          return sendJson(res, 400, { success: false, error: 'Invalid entries payload' });
        }

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // Replace user's entries with clean payload
          await client.query('DELETE FROM leave_entries WHERE user_id = $1', [user.id]);

          const insertQuery = `
            INSERT INTO leave_entries (id, user_id, year, s_no, date, day, leave_type, reason, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          `;

          for (const yearStr of Object.keys(entries)) {
            const year = parseInt(yearStr, 10);
            const rows = entries[yearStr];
            if (Array.isArray(rows)) {
              for (let idx = 0; idx < rows.length; idx++) {
                const r = rows[idx];
                const entryId = r.id || `entry_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
                await client.query(insertQuery, [
                  entryId,
                  user.id,
                  year,
                  idx + 1,
                  r.date || '',
                  r.day || (r.date ? getDayName(r.date) : ''),
                  r.leaveType || '',
                  r.reason || ''
                ]);
              }
            }
          }

          await client.query('COMMIT');
          return sendJson(res, 200, { success: true, message: 'Entries synced successfully' });
        } catch (err) {
          await client.query('ROLLBACK');
          console.error('Error syncing entries:', err);
          return sendJson(res, 500, { success: false, error: 'Failed to sync entries' });
        } finally {
          client.release();
        }
      }

      // 7. Data: Update Settings
      if (pathname === '/api/settings' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { years, leaveTypes } = body;

        if (!years || !Array.isArray(years) || !leaveTypes || !Array.isArray(leaveTypes)) {
          return sendJson(res, 400, { success: false, error: 'Invalid settings payload' });
        }

        await pool.query(`
          INSERT INTO user_settings (user_id, years, leave_types, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            years = EXCLUDED.years,
            leave_types = EXCLUDED.leave_types,
            updated_at = NOW()
        `, [user.id, JSON.stringify(years), JSON.stringify(leaveTypes)]);

        return sendJson(res, 200, { success: true });
      }

      // 8. Admin: List All Users
      if (pathname === '/api/admin/users' && method === 'GET') {
        if (!user.isAdmin) {
          return sendJson(res, 403, { success: false, error: 'Access denied. Admin privileges required.' });
        }

        const usersRes = await pool.query(`
          SELECT 
            u.id, 
            u.username, 
            u.display_name, 
            u.is_admin, 
            u.created_at,
            COUNT(le.id)::int as entry_count
          FROM users u
          LEFT JOIN leave_entries le ON le.user_id = u.id
          GROUP BY u.id
          ORDER BY u.id ASC
        `);

        return sendJson(res, 200, {
          success: true,
          users: usersRes.rows.map(u => ({
            id: u.id,
            username: u.username,
            displayName: u.display_name,
            isAdmin: u.is_admin === true,
            createdAt: u.created_at,
            entryCount: u.entry_count
          }))
        });
      }

      // 9. Admin: Create New User
      if (pathname === '/api/admin/users' && method === 'POST') {
        if (!user.isAdmin) {
          return sendJson(res, 403, { success: false, error: 'Access denied. Admin privileges required.' });
        }

        const body = await parseJsonBody(req);
        const { username, password, displayName, isAdmin } = body;

        const trimmedUser = (username || '').trim();
        const trimmedPass = (password || '').trim();
        const trimmedDisplay = (displayName || '').trim() || trimmedUser;

        if (!trimmedUser || trimmedUser.length < 2) {
          return sendJson(res, 400, { success: false, error: 'Username must be at least 2 characters long' });
        }
        if (!trimmedPass || trimmedPass.length < 3) {
          return sendJson(res, 400, { success: false, error: 'Password must be at least 3 characters long' });
        }

        // Check if username already exists
        const exists = await pool.query(`
          SELECT id FROM users WHERE LOWER(username) = LOWER($1)
        `, [trimmedUser]);

        if (exists.rows.length > 0) {
          return sendJson(res, 400, { success: false, error: `User "${trimmedUser}" already exists` });
        }

        // Insert new user
        const newUsrRes = await pool.query(`
          INSERT INTO users (username, password, display_name, is_admin)
          VALUES ($1, $2, $3, $4)
          RETURNING id, username, display_name, is_admin, created_at
        `, [trimmedUser, trimmedPass, trimmedDisplay, isAdmin === true]);

        const newUserId = newUsrRes.rows[0].id;

        // Initialize default settings for the new user
        await pool.query(`
          INSERT INTO user_settings (user_id, years, leave_types)
          VALUES ($1, $2, $3)
        `, [newUserId, JSON.stringify([2026]), JSON.stringify(DEFAULT_LEAVE_TYPES)]);

        return sendJson(res, 201, {
          success: true,
          user: {
            id: newUserId,
            username: newUsrRes.rows[0].username,
            displayName: newUsrRes.rows[0].display_name,
            isAdmin: newUsrRes.rows[0].is_admin === true,
            createdAt: newUsrRes.rows[0].created_at,
            entryCount: 0
          }
        });
      }

      // 10. Admin: Reset Password for User
      const resetPassMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/reset-password$/);
      if (resetPassMatch && method === 'POST') {
        if (!user.isAdmin) {
          return sendJson(res, 403, { success: false, error: 'Access denied. Admin privileges required.' });
        }

        const targetUserId = parseInt(resetPassMatch[1], 10);
        const body = await parseJsonBody(req);
        const { newPassword } = body;

        if (!newPassword || newPassword.trim().length < 3) {
          return sendJson(res, 400, { success: false, error: 'New password must be at least 3 characters' });
        }

        await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [newPassword.trim(), targetUserId]);
        return sendJson(res, 200, { success: true, message: 'Password updated successfully' });
      }

      // 11. Admin: Delete User
      const deleteUserMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
      if (deleteUserMatch && method === 'DELETE') {
        if (!user.isAdmin) {
          return sendJson(res, 403, { success: false, error: 'Access denied. Admin privileges required.' });
        }

        const targetUserId = parseInt(deleteUserMatch[1], 10);
        if (targetUserId === user.id) {
          return sendJson(res, 400, { success: false, error: 'You cannot delete your own admin account.' });
        }

        // Prevent deleting original Nisanth user
        const targetCheck = await pool.query(`SELECT username FROM users WHERE id = $1`, [targetUserId]);
        if (targetCheck.rows.length === 0) {
          return sendJson(res, 404, { success: false, error: 'User not found' });
        }
        if (targetCheck.rows[0].username.toLowerCase() === 'nisanth') {
          return sendJson(res, 400, { success: false, error: 'Cannot delete primary admin Nisanth.' });
        }

        await pool.query(`DELETE FROM users WHERE id = $1`, [targetUserId]);
        return sendJson(res, 200, { success: true, message: 'User deleted successfully' });
      }

      return sendJson(res, 404, { error: 'API route not found' });
    } catch (err) {
      console.error(`API Error on ${method} ${pathname}:`, err);
      return sendJson(res, 500, { success: false, error: err.message || 'Internal Server Error' });
    }
  }

  // Static File Serving
  let reqPath = pathname;
  if (reqPath === '/') reqPath = '/index.html';
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

async function startServer() {
  try {
    await initDatabase();
    server.listen(PORT, () => {
      console.log(`Leave Tracker server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start Leave Tracker server:', err);
    process.exit(1);
  }
}

startServer();
