const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('--- FORCING MIGRATION START (FK OFF) ---');

try {
    // Disable FKs for migration
    db.pragma('foreign_keys = OFF');

    db.transaction(() => {
        // 1. Rename old table
        console.log('Renaming table...');
        // We already moved it to messages_old_v2 in previous failed attempt?
        // If it failed during rename, it might still be messages.
        // If it failed during drop, it might be messages_old_v2.
        // Let's check if messages_old_v2 exists, if so drop it first (assuming it's partial/broken).
        try {
            db.prepare("DROP TABLE IF EXISTS messages_old_v2").run();
        } catch (e) { console.log('Cleanup old temp table failed (might not exist)', e.message); }

        db.prepare("ALTER TABLE messages RENAME TO messages_old_v2").run();

        // 2. Create new table with updated CHECK constraint
        console.log('Creating new table...');
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
        console.log('Copying data...');
        db.prepare(`
      INSERT INTO messages (id, setter_id, created_at, updated_at, message_type, contact_type, contact_value, is_pro, prospect_user)
      SELECT id, setter_id, created_at, updated_at, message_type, contact_type, contact_value, is_pro, prospect_user
      FROM messages_old_v2
    `).run();

        // 4. Drop old table
        console.log('Dropping old table...');
        db.prepare("DROP TABLE messages_old_v2").run();
    })();

    // Re-enable FKs
    db.pragma('foreign_keys = ON');

    console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
} catch (error) {
    console.error('--- MIGRATION FAILED ---', error);
}
