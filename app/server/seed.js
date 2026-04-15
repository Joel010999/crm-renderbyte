const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

const now = new Date().toISOString();

// Create Admin
const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (adminExists) {
    // Update password
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE username = ?').run(passwordHash, now, 'admin');
    console.log('Admin password reset to: admin123');
} else {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
    INSERT INTO users (username, password_hash, real_name, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 'admin', 1, ?, ?)
  `).run('admin', passwordHash, 'System Admin', now, now);
    console.log('Admin created: admin / admin123');
}

// Create Test Setter
const setterExists = db.prepare('SELECT * FROM users WHERE username = ?').get('test');
if (setterExists) {
    const passwordHash = bcrypt.hashSync('test123', 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE username = ?').run(passwordHash, now, 'test');
    console.log('Setter password reset to: test123');
} else {
    const passwordHash = bcrypt.hashSync('test123', 10);
    db.prepare(`
    INSERT INTO users (username, password_hash, real_name, role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 'setter', 1, ?, ?)
  `).run('test', passwordHash, 'Test Setter', now, now);
    console.log('Setter created: test / test123');
}

console.log('\n✅ Users ready!');
console.log('Admin:  admin / admin123');
console.log('Setter: test / test123');

db.close();
