const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
console.log('--- FULL SCHEMA ---');
tables.forEach(t => {
    console.log(`-- Table: ${t.name}`);
    console.log(t.sql);
    console.log('');
});
