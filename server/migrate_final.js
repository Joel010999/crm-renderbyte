const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('Starting forceful migration...');

try {
    db.exec('PRAGMA foreign_keys=OFF;');
    db.exec('BEGIN TRANSACTION;');

    // 1. Check if messages_old exists (clean up from failed runs)
    db.exec('DROP TABLE IF EXISTS messages_old;');

    // 2. Rename current table
    db.exec('ALTER TABLE messages RENAME TO messages_old;');

    // 3. Create new table with correct constraints
    db.exec(`
      CREATE TABLE messages (
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
    `);

    // 4. Copy data with mapping
    // Mapping:
    // 'nuevos' -> 'nuevo'
    // 'contactados', 'avanzados', 'seguimiento' -> 'seguimiento'
    // 'cerrados', 'perdidos' -> 'perdido'
    db.exec(`
      INSERT INTO messages (id, setter_id, created_at, updated_at, message_type, contact_type, contact_value, is_pro)
      SELECT 
        id, 
        setter_id, 
        created_at, 
        updated_at, 
        CASE 
          WHEN message_type = 'nuevos' THEN 'nuevo'
          WHEN message_type IN ('contactados', 'avanzados', 'seguimiento') THEN 'seguimiento'
          WHEN message_type IN ('cerrados', 'perdidos', 'perdido') THEN 'perdido'
          ELSE 'nuevo'
        END as message_type,
        contact_type, 
        contact_value, 
        is_pro
      FROM messages_old;
    `);

    // 5. Drop old table
    db.exec('DROP TABLE messages_old;');

    db.exec('COMMIT;');
    db.exec('PRAGMA foreign_keys=ON;');
    console.log('Migration successful: CHECK constraints updated and data migrated.');
} catch (err) {
    db.exec('ROLLBACK;');
    console.error('Migration failed:', err);
    process.exit(1);
}
