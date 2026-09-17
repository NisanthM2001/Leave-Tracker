const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_hfqLvrcz1G6o@ep-rough-pond-b4ga7ctf-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Helper for Day calculation
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function getDayName(dateString) {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return '';
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(d.getTime())) return '';
  return DAY_NAMES[d.getDay()] || '';
}

const DEFAULT_LEAVE_TYPES = [
  { id: 'leave', name: 'Leave', color: 'red', category: 'Annual / Vacation' },
  { id: 'wfh', name: 'Work From Home', color: 'green', category: 'Remote Working' },
  { id: 'sick', name: 'Sick Leave', color: 'yellow', category: 'Medical' }
];

async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('Connected to Neon PostgreSQL database. Verifying schema...');

    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 2. User sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        token VARCHAR(128) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
    `);

    // 3. User settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        years JSONB NOT NULL DEFAULT '[2026]',
        leave_types JSONB NOT NULL DEFAULT '[]',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 4. Leave entries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_entries (
        id VARCHAR(100) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        s_no INTEGER NOT NULL,
        date VARCHAR(20) DEFAULT '',
        day VARCHAR(20) DEFAULT '',
        leave_type VARCHAR(100) DEFAULT '',
        reason TEXT DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_leave_entries_user_year ON leave_entries(user_id, year);
    `);

    // 5. Ensure primary admin user exists
    const adminCheck = await client.query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1)`, ['Nisanth']);
    let adminUserId;

    if (adminCheck.rows.length === 0) {
      console.log('Initializing primary admin user Nisanth...');
      const insertAdmin = await client.query(`
        INSERT INTO users (username, password, display_name, is_admin)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['Nisanth', 'Nisanth@2001', 'Nisanth', true]);
      adminUserId = insertAdmin.rows[0].id;

      await client.query(`
        INSERT INTO user_settings (user_id, years, leave_types)
        VALUES ($1, $2, $3)
      `, [adminUserId, JSON.stringify([2026]), JSON.stringify(DEFAULT_LEAVE_TYPES)]);
    } else {
      adminUserId = adminCheck.rows[0].id;
      await client.query(`UPDATE users SET is_admin = true WHERE id = $1`, [adminUserId]);

      const settingsCheck = await client.query(`SELECT user_id FROM user_settings WHERE user_id = $1`, [adminUserId]);
      if (settingsCheck.rows.length === 0) {
        await client.query(`
          INSERT INTO user_settings (user_id, years, leave_types)
          VALUES ($1, $2, $3)
        `, [adminUserId, JSON.stringify([2026]), JSON.stringify(DEFAULT_LEAVE_TYPES)]);
      }
    }

    console.log('Neon PostgreSQL database is active and ready.');
  } catch (err) {
    console.error('Error during database initialization:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDatabase,
  DEFAULT_LEAVE_TYPES,
  getDayName
};
