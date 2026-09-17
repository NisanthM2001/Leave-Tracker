const crypto = require('crypto');
const { pool, ensureDatabase, DEFAULT_LEAVE_TYPES, getDayName } = require('../../db.js');

const CORS_HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

function send(statusCode, data) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data)
  };
}

function getHeader(headers, name) {
  if (!headers) return null;
  const target = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) return headers[key];
  }
  return null;
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    console.error('Failed to parse request body:', e.message);
    return {};
  }
}

function extractPath(event) {
  let p = event.path || '';
  if (p.includes('/.netlify/functions/api')) {
    p = p.replace('/.netlify/functions/api', '/api');
  }
  if (!p.startsWith('/api')) {
    p = '/api' + (p.startsWith('/') ? p : '/' + p);
  }
  return p.replace(/\/+$/, '');
}

async function authenticate(event) {
  const authHeader = getHeader(event.headers, 'authorization');
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
    console.error('Auth check error:', err);
    return null;
  }
}

exports.handler = async (event, context) => {
  // Ensure background execution completes
  context.callbackWaitsForEmptyEventLoop = false;

  const method = (event.httpMethod || 'GET').toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: ''
    };
  }

  try {
    await ensureDatabase();
  } catch (dbErr) {
    console.error('Database connection error in Netlify function:', dbErr);
    return send(500, {
      success: false,
      error: 'Database connection error: ' + dbErr.message
    });
  }

  const pathname = extractPath(event);

  try {
    // 1. Health check
    if (pathname === '/api/health' && method === 'GET') {
      const start = Date.now();
      const dbRes = await pool.query('SELECT NOW() as time');
      return send(200, {
        status: 'ok',
        database: 'connected',
        provider: 'Neon PostgreSQL (Netlify Serverless)',
        latencyMs: Date.now() - start,
        serverTime: dbRes.rows[0].time
      });
    }

    // 2. Auth: Login
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = parseBody(event);
      const { username, password } = body;

      if (!username || !password) {
        return send(400, { success: false, error: 'Username and password required' });
      }

      const userCheck = await pool.query(`
        SELECT id, username, display_name, password, is_admin
        FROM users
        WHERE LOWER(username) = LOWER($1)
      `, [username.trim()]);

      if (userCheck.rows.length === 0 || userCheck.rows[0].password !== password) {
        return send(401, { success: false, error: 'Invalid username or password' });
      }

      const user = userCheck.rows[0];
      const token = crypto.randomUUID();

      await pool.query(`
        INSERT INTO user_sessions (token, user_id)
        VALUES ($1, $2)
      `, [token, user.id]);

      return send(200, {
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

    // 3. Auth: Me
    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = await authenticate(event);
      if (!user) return send(401, { success: false, error: 'Unauthorized' });
      return send(200, { success: true, user });
    }

    // 4. Auth: Logout
    if (pathname === '/api/auth/logout' && method === 'POST') {
      const authHeader = getHeader(event.headers, 'authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        await pool.query(`DELETE FROM user_sessions WHERE token = $1`, [token]);
      }
      return send(200, { success: true });
    }

    // Authenticate all remaining endpoints
    const user = await authenticate(event);
    if (!user) {
      return send(401, { success: false, error: 'Unauthorized. Please sign in.' });
    }

    // 5. Data: Load User Entries & Settings
    if (pathname === '/api/data' && method === 'GET') {
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
      }

      const entriesRes = await pool.query(`
        SELECT id, year, s_no, date, day, leave_type, reason
        FROM leave_entries
        WHERE user_id = $1
        ORDER BY year ASC, s_no ASC
      `, [user.id]);

      const entries = {};
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

      return send(200, {
        success: true,
        settings,
        entries
      });
    }

    // 6. Data: Sync Entries
    if (pathname === '/api/entries/sync' && method === 'POST') {
      const body = parseBody(event);
      const { entries } = body;

      if (!entries || typeof entries !== 'object') {
        return send(400, { success: false, error: 'Invalid entries payload' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
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
        return send(200, { success: true, message: 'Entries synced successfully' });
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error syncing entries:', err);
        return send(500, { success: false, error: 'Failed to sync entries' });
      } finally {
        client.release();
      }
    }

    // 7. Data: Update Settings
    if (pathname === '/api/settings' && method === 'POST') {
      const body = parseBody(event);
      const { years, leaveTypes } = body;

      if (!years || !Array.isArray(years) || !leaveTypes || !Array.isArray(leaveTypes)) {
        return send(400, { success: false, error: 'Invalid settings payload' });
      }

      await pool.query(`
        INSERT INTO user_settings (user_id, years, leave_types, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          years = EXCLUDED.years,
          leave_types = EXCLUDED.leave_types,
          updated_at = NOW()
      `, [user.id, JSON.stringify(years), JSON.stringify(leaveTypes)]);

      return send(200, { success: true });
    }

    // Admin Endpoints
    if (pathname.startsWith('/api/admin/')) {
      if (!user.isAdmin) {
        return send(403, { success: false, error: 'Access denied. Admin privileges required.' });
      }

      // 8. Admin: List All Users
      if (pathname === '/api/admin/users' && method === 'GET') {
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

        return send(200, {
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
        const body = parseBody(event);
        const { username, password, displayName, isAdmin } = body;

        const trimmedUser = (username || '').trim();
        const trimmedPass = (password || '').trim();
        const trimmedDisplay = (displayName || '').trim() || trimmedUser;

        if (!trimmedUser || trimmedUser.length < 2) {
          return send(400, { success: false, error: 'Username must be at least 2 characters' });
        }
        if (!trimmedPass || trimmedPass.length < 3) {
          return send(400, { success: false, error: 'Password must be at least 3 characters' });
        }

        const exists = await pool.query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, [trimmedUser]);
        if (exists.rows.length > 0) {
          return send(400, { success: false, error: `User "${trimmedUser}" already exists` });
        }

        const newUsrRes = await pool.query(`
          INSERT INTO users (username, password, display_name, is_admin)
          VALUES ($1, $2, $3, $4)
          RETURNING id, username, display_name, is_admin, created_at
        `, [trimmedUser, trimmedPass, trimmedDisplay, isAdmin === true]);

        const newUserId = newUsrRes.rows[0].id;

        await pool.query(`
          INSERT INTO user_settings (user_id, years, leave_types)
          VALUES ($1, $2, $3)
        `, [newUserId, JSON.stringify([2026]), JSON.stringify(DEFAULT_LEAVE_TYPES)]);

        return send(201, {
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

      // 10. Admin: Reset Password
      const resetPassMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/reset-password$/);
      if (resetPassMatch && method === 'POST') {
        const targetUserId = parseInt(resetPassMatch[1], 10);
        const body = parseBody(event);
        const { newPassword } = body;

        if (!newPassword || newPassword.trim().length < 3) {
          return send(400, { success: false, error: 'New password must be at least 3 characters' });
        }

        await pool.query(`UPDATE users SET password = $1 WHERE id = $2`, [newPassword.trim(), targetUserId]);
        return send(200, { success: true, message: 'Password updated successfully' });
      }

      // 11. Admin: Delete User
      const deleteUserMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
      if (deleteUserMatch && method === 'DELETE') {
        const targetUserId = parseInt(deleteUserMatch[1], 10);
        if (targetUserId === user.id) {
          return send(400, { success: false, error: 'You cannot delete your own admin account.' });
        }

        const targetCheck = await pool.query(`SELECT username FROM users WHERE id = $1`, [targetUserId]);
        if (targetCheck.rows.length === 0) {
          return send(404, { success: false, error: 'User not found' });
        }
        if (targetCheck.rows[0].username.toLowerCase() === 'nisanth') {
          return send(400, { success: false, error: 'Cannot delete primary admin Nisanth.' });
        }

        await pool.query(`DELETE FROM users WHERE id = $1`, [targetUserId]);
        return send(200, { success: true, message: 'User deleted successfully' });
      }
    }

    return send(404, { error: 'Not Found', path: pathname });
  } catch (err) {
    console.error('Unhandled API error in Netlify function:', err);
    return send(500, { success: false, error: err.message || 'Internal Server Error' });
  }
};
