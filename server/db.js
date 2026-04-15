const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const { DateTime } = require('luxon');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    real_name TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'setter')) NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setter_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    message_type TEXT CHECK(message_type IN ('nuevo', 'seguimiento', 'perdido')) NOT NULL,
    contact_type TEXT CHECK(contact_type IN ('instagram', 'whatsapp')) NOT NULL,
    contact_value TEXT NOT NULL,
    is_pro INTEGER DEFAULT 0,
    FOREIGN KEY (setter_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS message_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    old_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`);

// Ensure basic production admin exists (Persistent)
const ensureProductionAdmin = () => {
  const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('render');
  const now = DateTime.now().setZone('America/Argentina/Cordoba').toISO();

  if (!admin) {
    const passwordHash = bcrypt.hashSync('byte', 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, real_name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('render', passwordHash, 'Render Admin', 'admin', now, now);
    console.log('Production Admin Verified: render / byte');
  }
};

// Migration: Add new columns if they don't exist
try {
  db.prepare("ALTER TABLE messages ADD COLUMN is_pro INTEGER DEFAULT 0").run();
} catch (e) { /* Column already exists */ }

try {
  db.prepare("ALTER TABLE messages ADD COLUMN updated_at TEXT").run();
} catch (e) { /* Column already exists */ }

try {
  db.prepare("ALTER TABLE messages ADD COLUMN prospect_user TEXT").run();
} catch (e) { /* Column already exists */ }

// Migration: Update CHECK constraint for 'cliente_potencial'
try {
  const checkMessage = db.prepare("SELECT message_type FROM messages WHERE message_type = 'cliente_potencial' LIMIT 1").get();
} catch (e) {
  // If selecting fails, it might be due to constraint, but here we want to proactively check if we need to migrate schema
  // A better check is to see if we can insert a dummy value or check sqlite_master, but given the request, let's force migration if needed.
  // We'll use a transaction to be safe.

  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'").get();
  if (!schema.sql.includes('cliente_potencial')) {
    console.log('Migrating messages table to support cliente_potencial...');
    db.transaction(() => {
      // 1. Rename old table
      db.prepare("ALTER TABLE messages RENAME TO messages_old").run();

      // 2. Create new table with updated CHECK
      db.prepare(`
        CREATE TABLE messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          setter_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT,
          message_type TEXT CHECK(message_type IN ('nuevo', 'seguimiento', 'perdido', 'cliente_potencial')) NOT NULL,
          contact_type TEXT CHECK(contact_type IN ('instagram', 'whatsapp')) NOT NULL,
          contact_value TEXT NOT NULL,
          is_pro INTEGER DEFAULT 0,
          prospect_user TEXT,
          FOREIGN KEY (setter_id) REFERENCES users (id)
        )
      `).run();

      // 3. Copy data
      db.prepare(`
        INSERT INTO messages (id, setter_id, created_at, updated_at, message_type, contact_type, contact_value, is_pro, prospect_user)
        SELECT id, setter_id, created_at, updated_at, message_type, contact_type, contact_value, is_pro, prospect_user
        FROM messages_old
      `).run();

      // 4. Drop old table
      db.prepare("DROP TABLE messages_old").run();
    })();
    console.log('Migration completed.');
  }
}

ensureProductionAdmin();

module.exports = db;
