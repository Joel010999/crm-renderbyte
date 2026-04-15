const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('--- FIXING HISTORY FK ---');

try {
    // Disable FKs for migration
    db.pragma('foreign_keys = OFF');

    db.transaction(() => {
        // 1. Rename old table
        console.log('Renaming table...');
        // cleanup in case of previous run failure
        try { db.prepare("DROP TABLE IF EXISTS message_history_old").run(); } catch (e) { }

        db.prepare("ALTER TABLE message_history RENAME TO message_history_old").run();

        // 2. Create new table with correct FK to 'messages'
        console.log('Creating new table...');
        // Copy the CREATE statement from db.js but ensure FK is correct
        db.prepare(`
      CREATE TABLE message_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        old_status TEXT NOT NULL,
        new_status TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (message_id) REFERENCES messages (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `).run();

        // 3. Copy data
        console.log('Copying data...');
        db.prepare(`
      INSERT INTO message_history (id, message_id, user_id, old_status, new_status, note, created_at)
      SELECT id, message_id, user_id, old_status, new_status, note, created_at
      FROM message_history_old
    `).run();

        // 4. Drop old table
        console.log('Dropping old table...');
        db.prepare("DROP TABLE message_history_old").run();
    })();

    // Re-enable FKs
    db.pragma('foreign_keys = ON');

    console.log('--- FIX COMPLETED SUCCESSFULLY ---');
} catch (error) {
    console.error('--- FIX FAILED ---', error);
}
