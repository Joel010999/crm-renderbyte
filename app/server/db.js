const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

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
    message_type TEXT CHECK(message_type IN ('nuevos', 'contactados', 'avanzados', 'seguimiento', 'cerrados', 'perdidos')) NOT NULL,
    contact_type TEXT CHECK(contact_type IN ('instagram', 'whatsapp')) NOT NULL,
    contact_value TEXT NOT NULL,
    FOREIGN KEY (setter_id) REFERENCES users (id)
  );
`);

// Seed Admin User
const seedAdmin = () => {
  const admin = db.prepare('SELECT * FROM users WHERE role = ?').get('admin');
  if (!admin) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (username, password_hash, real_name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('admin', passwordHash, 'System Admin', 'admin', now, now);
    console.log('Admin user seeded: admin / admin123');
  }
};

seedAdmin();

module.exports = db;
