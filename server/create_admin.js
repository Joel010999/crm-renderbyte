const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Copiá acá la DATABASE_PUBLIC_URL (la misma que usaste antes)
const connectionString = "postgresql://postgres:YvXUFmhuqXUPnxTeuMbxABsiEnUoDMpL@monorail.proxy.rlwy.net:24941/railway";

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function createAdmin() {
    const username = 'joel_admin'; // Cambialo si querés
    const password = '73152_admin'; // CAMBIÁ ESTO
    const realName = 'Joel';
    const now = new Date().toISOString();

    try {
        const passwordHash = bcrypt.hashSync(password, 10);
        await pool.query(`
      INSERT INTO users (username, password_hash, real_name, role, created_at, updated_at)
      VALUES ($1, $2, $3, 'admin', $4, $5)
    `, [username, passwordHash, realName, now, now]);
        console.log("✅ Administrador creado con éxito. Ya podés loguearte.");
    } catch (err) {
        console.error("❌ Error creando admin:", err.message);
    } finally {
        await pool.end();
    }
}

createAdmin();

