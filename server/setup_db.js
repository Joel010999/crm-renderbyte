const { Pool } = require('pg');
require('dotenv').config();

// Usamos la URL que te dio Railway en la pestaña Variables
// Asegurate de pegarla acá abajo entre las comillas
const connectionString = "postgresql://postgres:YvXUFmhuqXUPnxTeuMbxABsiEnUoDMpL@monorail.proxy.rlwy.net:24941/railway";

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

const schema = `
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    real_name TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'setter')) NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    setter_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ,
    message_type TEXT CHECK (message_type IN ('nuevo', 'seguimiento', 'perdido', 'cliente_potencial')) NOT NULL,
    contact_type TEXT CHECK (contact_type IN ('instagram', 'whatsapp')) NOT NULL,
    contact_value TEXT NOT NULL,
    prospect_user TEXT,
    is_pro INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS message_history (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES messages(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    old_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL
);
`;

async function setup() {
    try {
        console.log("🚀 Iniciando creación de tablas en Railway...");
        await pool.query(schema);
        console.log("✅ Tablas creadas con éxito.");
    } catch (err) {
        console.error("❌ Error creando las tablas:", err);
    } finally {
        await pool.end();
    }
}

setup();