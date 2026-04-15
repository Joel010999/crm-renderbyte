const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const { DateTime } = require('luxon');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('--- DATABASE RESET START ---');

try {
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('BEGIN TRANSACTION;');

    // 1. Wipe all messages
    db.exec('DELETE FROM messages;');
    console.log('Clearing messages... DONE');

    // 2. Wipe all users except 'render'
    db.exec("DELETE FROM users WHERE username != 'render';");
    console.log('Clearing users (except admin)... DONE');

    // 3. Ensure 'render' exists and has 'byte' password
    const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('render');
    const now = DateTime.now().setZone('America/Argentina/Cordoba').toISO();
    const passwordHash = bcrypt.hashSync('byte', 10);

    if (admin) {
        db.prepare(`
            UPDATE users SET password_hash = ?, is_active = 1, updated_at = ? WHERE username = ?
        `).run(passwordHash, now, 'render');
        console.log('Admin user updated: render / byte');
    } else {
        db.prepare(`
            INSERT INTO users (username, password_hash, real_name, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run('render', passwordHash, 'Render Admin', 'admin', now, now);
        console.log('Admin user created: render / byte');
    }

    db.exec('COMMIT;');
    db.exec('PRAGMA foreign_keys = ON;');
    console.log('--- DATABASE RESET SUCCESSFUL ---');
} catch (err) {
    db.exec('ROLLBACK;');
    console.error('--- DATABASE RESET FAILED ---', err);
    process.exit(1);
}
