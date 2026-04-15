const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('--- HISTORY SCHEMA ---');
try {
    const hist = db.prepare("SELECT sql FROM sqlite_master WHERE name='message_history'").get();
    console.log(hist ? hist.sql : 'TABLE NOT FOUND');
} catch (e) { console.log('TABLE ERROR', e.message); }
