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
const frontendPath = path.join(__dirname, 'dist');

app.use(cors());
app.use(express.json());
app.use(express.static(frontendPath));

const getArgentinaNow = () => DateTime.now().setZone('America/Argentina/Cordoba');

// --- Middlewares ---
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
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin privileges required' });
    next();
};

// --- Seed Admin ---
const seedAdmin = async () => {
    const adminUsername = 'joel_admin';
    const adminPassword = 'admin73152';
    try {
        const hash = bcrypt.hashSync(adminPassword, 10);
        const now = getArgentinaNow().toISO();
        await db.query(`
            INSERT INTO users (username, password_hash, real_name, role, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 1, $5, $6)
            ON CONFLICT (username) DO UPDATE SET password_hash = $2, updated_at = $6
        `, [adminUsername, hash, 'Joel', 'admin', now, now]);
        console.log('✅ SISTEMA DE ACCESO RENDERBYTE INICIADO');
    } catch (error) {
        console.error('❌ Error seed:', error.message);
    }
};

// --- Auth ---
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await db.query('SELECT * FROM users WHERE username = $1 AND is_active = 1', [username]);
        const user = result.rows[0];
        if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Credenciales inválidas' });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, real_name: user.real_name }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role, real_name: user.real_name } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/auth/me', authenticateToken, (req, res) => res.json(req.user));

// ==========================================
// --- RUTAS DEL SETTER (Dashboard Fix) ---
// ==========================================

app.get('/api/setter/metrics', authenticateToken, async (req, res) => {
    try {
        const now = getArgentinaNow();
        const t = now.startOf('day').toISO();
        const w = now.startOf('week').toISO();
        const m = now.startOf('month').toISO();
        const stats = await db.query(`
            SELECT 
                COUNT(CASE WHEN created_at >= $1 THEN 1 END) as today,
                COUNT(CASE WHEN created_at >= $2 THEN 1 END) as week,
                COUNT(CASE WHEN created_at >= $3 THEN 1 END) as month,
                COUNT(*) as total
            FROM messages WHERE setter_id = $4`, [t, w, m, req.user.id]);

        const row = stats.rows[0];
        // Aseguramos que devuelva números y no strings
        res.json({
            today: parseInt(row.today) || 0,
            week: parseInt(row.week) || 0,
            month: parseInt(row.month) || 0,
            total: parseInt(row.total) || 0
        });
    } catch (err) { res.json({ today: 0, week: 0, month: 0, total: 0 }); }
});

app.get('/api/setter/messages', authenticateToken, async (req, res) => {
    try {
        const { type, search, startDate, endDate, limit } = req.query;
        let query = `SELECT * FROM messages WHERE setter_id = $1`;
        let params = [req.user.id];
        let idx = 2;

        if (type) { query += ` AND message_type = $${idx}`; params.push(type); idx++; }
        if (search) { query += ` AND (prospect_user ILIKE $${idx} OR contact_value ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
        if (startDate) { query += ` AND created_at >= $${idx}`; params.push(startDate); idx++; }
        if (endDate) { query += ` AND created_at <= $${idx}`; params.push(endDate); idx++; }

        query += ` ORDER BY created_at DESC`;
        if (limit) { query += ` LIMIT $${idx}`; params.push(limit); }

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) { res.json([]); }
});

app.post('/api/setter/messages', authenticateToken, async (req, res) => {
    const { message_type, contact_type, contact_value, prospect_user } = req.body;
    const now = getArgentinaNow().toISO();
    try {
        await db.query(`INSERT INTO messages (setter_id, created_at, message_type, contact_type, contact_value, prospect_user, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $2)`,
            [req.user.id, now, message_type, contact_type, contact_value, prospect_user || '']);
        res.status(201).json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/setter/messages/:id', authenticateToken, async (req, res) => {
    try {
        const now = getArgentinaNow().toISO();
        await db.query(`UPDATE messages SET message_type = $1, updated_at = $2 WHERE id = $3 AND setter_id = $4`,
            [req.body.message_type, now, req.params.id, req.user.id]);
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/setter/messages/:id/history', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT h.*, u.real_name as user_name 
            FROM message_history h 
            JOIN users u ON h.user_id = u.id 
            WHERE h.message_id = $1 ORDER BY h.created_at DESC`, [req.params.id]);
        res.json(result.rows);
    } catch (err) { res.json([]); }
});

app.post('/api/setter/messages/:id/update', authenticateToken, async (req, res) => {
    const { new_status, note } = req.body;
    const now = getArgentinaNow().toISO();
    try {
        const msg = await db.query('SELECT message_type FROM messages WHERE id = $1', [req.params.id]);
        if (msg.rows.length === 0) return res.status(404).send('Not found');

        await db.query('BEGIN');
        await db.query(`UPDATE messages SET message_type = $1, updated_at = $2 WHERE id = $3`, [new_status, now, req.params.id]);
        await db.query(`INSERT INTO message_history (message_id, user_id, old_status, new_status, note, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.params.id, req.user.id, msg.rows[0].message_type, new_status, note, now]);
        await db.query('COMMIT');
        res.json({ message: 'OK' });
    } catch (err) { await db.query('ROLLBACK'); res.status(500).send(err.message); }
});

// ==========================================
// --- RUTAS DEL ADMIN (Dashboard) ---
// ==========================================

app.get('/api/admin/setters', authenticateToken, isAdmin, async (req, res) => {
    try {
        const users = await db.query(`SELECT id, username, real_name, role, is_active FROM users WHERE role = 'setter' AND is_active = 1`);
        const now = getArgentinaNow();
        const t = now.startOf('day').toISO();
        const w = now.startOf('week').toISO();
        const m = now.startOf('month').toISO();
        const enriched = [];
        for (const u of users.rows) {
            const stats = await db.query(`SELECT 
                COUNT(CASE WHEN created_at >= $1 THEN 1 END) as today,
                COUNT(CASE WHEN created_at >= $2 THEN 1 END) as week,
                COUNT(CASE WHEN created_at >= $3 THEN 1 END) as month 
                FROM messages WHERE setter_id = $4`, [t, w, m, u.id]);
            enriched.push({ ...u, today: parseInt(stats.rows[0].today), week: parseInt(stats.rows[0].week), month: parseInt(stats.rows[0].month) });
        }
        res.json(enriched);
    } catch (err) { res.json([]); }
});

app.get('/api/admin/breakdown/lifetime', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await db.query(`SELECT message_type as type, COUNT(*) as count FROM messages GROUP BY message_type`);
        res.json(result.rows);
    } catch (err) { res.json([]); }
});

app.get('/api/admin/messages', authenticateToken, isAdmin, async (req, res) => {
    const { period } = req.query;
    const now = getArgentinaNow();
    let start = period === 'today' ? now.startOf('day') : (period === 'week' ? now.startOf('week') : now.startOf('month'));
    try {
        const msgRes = await db.query(`
            SELECT m.*, u.real_name as setter_name, u.username as setter_username 
            FROM messages m JOIN users u ON m.setter_id = u.id 
            WHERE m.created_at >= $1 ORDER BY m.created_at DESC`, [start.toISO()]);
        const bRes = await db.query(`SELECT message_type as type, COUNT(*) as count FROM messages WHERE created_at >= $1 GROUP BY message_type`, [start.toISO()]);
        res.json({ messages: msgRes.rows, breakdown: bRes.rows, total: msgRes.rows.length });
    } catch (err) { res.json({ messages: [], breakdown: [], total: 0 }); }
});

// --- Leaderboard ---
app.get('/api/leaderboard', authenticateToken, async (req, res) => {
    const { period } = req.query;
    const now = getArgentinaNow();
    let start = period === 'today' ? now.startOf('day') : (period === 'week' ? now.startOf('week') : now.startOf('month'));
    try {
        const result = await db.query(`
            SELECT u.real_name, u.username, COUNT(m.id) as count 
            FROM users u 
            LEFT JOIN messages m ON u.id = m.setter_id AND m.created_at >= $1 
            WHERE u.role = 'setter' AND u.is_active = 1 
            GROUP BY u.id, u.real_name, u.username 
            ORDER BY count DESC LIMIT 3`, [start.toISO()]);
        res.json(result.rows);
    } catch (err) { res.json([]); }
});

// --- Backups y Export ---
app.get('/api/admin/backups', authenticateToken, isAdmin, (req, res) => {
    try {
        const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.xlsx')).map(f => ({
            filename: f, createdAt: fs.statSync(path.join(backupsDir, f)).birthtime, size: fs.statSync(path.join(backupsDir, f)).size
        }));
        res.json(files);
    } catch (err) { res.json([]); }
});

app.get('/api/admin/backups/download/:filename', authenticateToken, isAdmin, (req, res) => {
    const file = path.join(backupsDir, req.params.filename);
    if (fs.existsSync(file)) res.download(file);
    else res.status(404).send('No existe');
});

cron.schedule('0 3 * * *', async () => {
    try {
        const result = await db.query(`SELECT m.*, u.real_name as setter_name FROM messages m JOIN users u ON m.setter_id = u.id ORDER BY m.created_at DESC`);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Backup');
        result.rows.forEach(row => sheet.addRow(row));
        const filename = `backup_${DateTime.now().toFormat('yyyy-MM-dd_HHmmss')}.xlsx`;
        await workbook.xlsx.writeFile(path.join(backupsDir, filename));
    } catch (err) { console.error('Backup fail'); }
});

// --- RUTA WEB ---
app.get('*', (req, res) => {
    const idx = path.join(frontendPath, 'index.html');
    if (fs.existsSync(idx)) res.sendFile(idx);
    else res.status(404).send("Front no encontrado");
});

app.listen(PORT, '0.0.0.0', async () => {
    await seedAdmin();
    console.log(`🚀 RenderByte CRM corriendo en puerto ${PORT}`);
});