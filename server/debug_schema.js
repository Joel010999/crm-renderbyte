const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='messages'").get();
console.log('--- Current Schema for messages table ---');
console.log(schema.sql);
console.log('-----------------------------------------');
