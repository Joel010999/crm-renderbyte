const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { DateTime } = require('luxon');
const ExcelJS = require('exceljs');
const db = require('./db');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir);
}

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// --- CONFIGURACIÓN DE RUTAS DE CARPETAS ---
// Esto detecta si estamos en Railway o en tu compu y busca la carpeta dist
const frontendPath = path.resolve(__dirname, '..', 'client', 'dist');
console.log("🔍 Buscando frontend en:", frontendPath);

app.use(cors());
app.use(express.json());

// Servir archivos estáticos (CSS, JS, Imágenes)
app.use(express.static(frontendPath));

const getArgentinaNow = () => DateTime.now().setZone('America/Argentina/Cordoba');

// --- Middlewares de Seguridad ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
    }
    next();
};

// --- Rutas de Auth ---
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await db.query('SELECT * FROM users WHERE username = $1 AND is_active = 1', [username]);
        const user = result.rows[0];

        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, real_name: user.real_name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, user: { id: user.id, username: user.username, role: user.role, real_name: user.real_name } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    res.json(req.user);
});

// --- Admin: Gestión de Setters ---
app.post('/api/admin/setters', authenticateToken, isAdmin, async (req, res) => {
    const { username, password, real_name } = req.body;
    const now = getArgentinaNow().toISO();
    try {
        const passwordHash = bcrypt.hashSync(password, 10);
        await db.query(`INSERT INTO users (username, password_hash, real_name, role, created_at, updated_at) VALUES ($1, $2, $3, 'setter', $4, $5)`, [username, passwordHash, real_name, now, now]);
        res.status(201).json({ message: 'Setter created successfully' });
    } catch (error) {
        if (error.code === '23505') return res.status(400).json({ error: 'Username already exists' });
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/setters', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await db.query(`SELECT id, username, real_name, is_active, created_at FROM users WHERE role = 'setter' AND is_active = 1`);
        const setters = result.rows;
        const now = getArgentinaNow();
        const todayStart = now.startOf('day').toISO();
        const weekStart = now.startOf('week').toISO();
        const monthStart = now.startOf('month').toISO();
        const enrichedSetters = [];
        for (const s of setters) {
            const statsRes = await db.query(`SELECT COUNT(CASE WHEN created_at >= $1 THEN 1 END) as today, COUNT(CASE WHEN created_at >= $2 THEN 1 END) as week, COUNT(CASE WHEN created_at >= $3 THEN 1 END) as month FROM messages WHERE setter_id = $4`, [todayStart, weekStart, monthStart, s.id]);
            enrichedSetters.push({ ...s, ...statsRes.rows[0] });
        }
        res.json(enrichedSetters);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Rutas de Setters ---
app.post('/api/setter/messages', authenticateToken, async (req, res) => {
    const { message_type, contact_type, contact_value, prospect_user } = req.body;
    const now = getArgentinaNow().toISO();
    try {
        await db.query(`INSERT INTO messages (setter_id, created_at, message_type, contact_type, contact_value, prospect_user, is_pro) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [req.user.id, now, message_type, contact_type, contact_value, prospect_user || '', 0]);
        res.status(201).json({ message: 'Message logged' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/setter/metrics', authenticateToken, async (req, res) => {
    const now = getArgentinaNow();
    const todayStart = now.startOf('day').toISO();
    const weekStart = now.startOf('week').toISO();
    const monthStart = now.startOf('month').toISO();
    try {
        const stats = await db.query(`SELECT COUNT(CASE WHEN created_at >= $1 THEN 1 END) as today, COUNT(CASE WHEN created_at >= $2 THEN 1 END) as week, COUNT(CASE WHEN created_at >= $3 THEN 1 END) as month, COUNT(*) as total FROM messages WHERE setter_id = $4`, [todayStart, weekStart, monthStart, req.user.id]);
        res.json(stats.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

// --- RUTA FINAL PARA LA WEB ---
app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`Error: No se encontró el index.html en ${frontendPath}. Revisá el build.`);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});