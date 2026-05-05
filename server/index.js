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

// --- Seed Admin (Estable) ---
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
        console.log('✅ ADMIN CONFIGURADO CORRECTAMENTE');
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
        if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, real_name: user.real_name }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, username: user.username, role: user.role, real_name: user.real_name } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/auth/me', authenticateToken, (req, res) => res.json(req.user));

// --- 1) SETTERS: Lista para la tabla principal ---
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
            enriched.push({ ...u, ...stats.rows[0] });
        }
        res.json(enriched);
    } catch (err) { res.json([]); }
});

// --- 2) LIFETIME BREAKDOWN: Requerido por la línea 172 de tu Front ---
app.get('/api/admin/breakdown/lifetime', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await db.query(`SELECT message_type as type, COUNT(*) as count FROM messages GROUP BY message_type`);
        res.json(result.rows);
    } catch (err) { res.json([]); }
});

// --- 3) METRICS: Cuadritos de arriba ---
app.get('/api/admin/metrics', authenticateToken, isAdmin, async (req, res) => {
    const { period } = req.query;
    const now = getArgentinaNow();
    let start = period === 'today' ? now.startOf('day') : (period === 'week' ? now.startOf('week') : now.startOf('month'));
    try {
        const result = await db.query(`SELECT COUNT(*) as total FROM messages WHERE created_at >= $1`, [start.toISO()]);
        res.json(result.rows[0] || { total: 0 });
    } catch (err) { res.json({ total: 0 }); }
});

// --- 4) MESSAGES: Estructura del Modal para evitar el crash del .find() ---
app.get('/api/admin/messages', authenticateToken, isAdmin, async (req, res) => {
    const { period } = req.query;
    const now = getArgentinaNow();
    let start = period === 'today' ? now.startOf('day') : (period === 'week' ? now.startOf('week') : now.startOf('month'));
    try {
        const msgRes = await db.query(`SELECT m.*, u.real_name as setter_name, u.username as setter_username 
            FROM messages m JOIN users u ON m.setter_id = u.id 
            WHERE m.created_at >= $1 ORDER BY m.created_at DESC`, [start.toISO()]);

        const bRes = await db.query(`SELECT message_type as type, COUNT(*) as count 
            FROM messages WHERE created_at >= $1 GROUP BY message_type`, [start.toISO()]);

        res.json({
            messages: msgRes.rows,
            breakdown: bRes.rows,
            total: msgRes.rows.length
        });
    } catch (err) { res.json({ messages: [], breakdown: [], total: 0 }); }
});

// --- Gestión de Setters ---
app.post('/api/admin/setters', authenticateToken, isAdmin, async (req, res) => {
    const { username, password, real_name } = req.body;
    try {
        const hash = bcrypt.hashSync(password, 10);
        const now = getArgentinaNow().toISO();
        await db.query(`INSERT INTO users (username, password_hash, real_name, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, 'setter', 1, $4, $5)`, [username, hash, real_name, now, now]);
        res.status(201).json({ message: 'Success' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/setters/:id/password', authenticateToken, isAdmin, async (req, res) => {
    try {
        const hash = bcrypt.hashSync(req.body.password, 10);
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/setters/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await db.query('UPDATE users SET is_active = 0 WHERE id = $1', [req.params.id]);
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Backups ---
app.get('/api/admin/backups', authenticateToken, isAdmin, (req, res) => {
    try {
        const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.xlsx')).map(f => {
            const stats = fs.statSync(path.join(backupsDir, f));
            return { filename: f, createdAt: stats.birthtime, size: stats.size };
        });
        res.json(files);
    } catch (err) { res.json([]); }
});

app.get('/api/admin/backups/download/:filename', authenticateToken, isAdmin, (req, res) => {
    const file = path.join(backupsDir, req.params.filename);
    if (fs.existsSync(file)) res.download(file);
    else res.status(404).send('No existe');
});

app.get('/api/admin/export', authenticateToken, isAdmin, async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const result = await db.query(`SELECT m.*, u.real_name as setter_name FROM messages m JOIN users u ON m.setter_id = u.id WHERE m.created_at::date BETWEEN $1 AND $2 ORDER BY m.created_at DESC`, [startDate, endDate]);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Reporte');
        sheet.columns = [
            { header: 'Setter', key: 'setter_name', width: 20 },
            { header: 'Tipo', key: 'message_type', width: 15 },
            { header: 'Valor', key: 'contact_value', width: 25 },
            { header: 'Fecha', key: 'created_at', width: 25 }
        ];
        result.rows.forEach(row => sheet.addRow(row));
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=export.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) { res.status(500).send(err.message); }
});

// --- Cron ---
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

// --- Rutas Setter ---
app.post('/api/setter/messages', authenticateToken, async (req, res) => {
    const { message_type, contact_type, contact_value, prospect_user } = req.body;
    const now = getArgentinaNow().toISO();
    try {
        await db.query(`INSERT INTO messages (setter_id, created_at, message_type, contact_type, contact_value, prospect_user, is_pro) VALUES ($1, $2, $3, $4, $5, $6, 0)`, [req.user.id, now, message_type, contact_type, contact_value, prospect_user || '']);
        res.status(201).json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Fallback ---
app.get('*', (req, res) => {
    const idx = path.join(frontendPath, 'index.html');
    if (fs.existsSync(idx)) res.sendFile(idx);
    else res.status(404).send("Front no encontrado");
});

app.listen(PORT, '0.0.0.0', async () => {
    await seedAdmin();
    console.log(`🚀 Server on ${PORT}`);
});