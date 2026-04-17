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

// La carpeta dist se ubica dentro de server/
const frontendPath = path.join(__dirname, 'dist');

app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
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

app.get('/api/setter/messages', authenticateToken, async (req, res) => {
    const { period, type } = req.query;
    const now = getArgentinaNow();
    let conditions = ['setter_id = $1'];
    let params = [req.user.id];
    let idx = 2;

    if (period) {
        let start;
        if (period === 'today') start = now.startOf('day');
        else if (period === 'week') start = now.startOf('week');
        else if (period === 'month') start = now.startOf('month');
        if (start) {
            conditions.push(`created_at >= $${idx}`);
            params.push(start.toISO());
            idx++;
        }
    }
    if (type) {
        conditions.push(`message_type = $${idx}`);
        params.push(type);
        idx++;
    }

    try {
        const result = await db.query(`SELECT * FROM messages WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/setter/messages/:id/update', authenticateToken, async (req, res) => {
    const { new_status, note } = req.body;
    const now = getArgentinaNow().toISO();
    try {
        const msgRes = await db.query('SELECT * FROM messages WHERE id = $1', [req.params.id]);
        const message = msgRes.rows[0];
        if (!message) return res.status(404).json({ error: 'Message not found' });

        await db.query('BEGIN');
        await db.query('UPDATE messages SET message_type = $1, updated_at = $2 WHERE id = $3', [new_status, now, req.params.id]);
        await db.query(`INSERT INTO message_history (message_id, user_id, old_status, new_status, note, created_at) VALUES ($1, $2, $3, $4, $5, $6)`, [req.params.id, req.user.id, message.message_type, new_status, note || '', now]);
        await db.query('COMMIT');

        res.json({ message: 'Status updated successfully' });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: 'Failed to update status' });
    }
});

app.get('/api/setter/messages/:id/history', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`SELECT mh.*, u.real_name as changed_by FROM message_history mh JOIN users u ON mh.user_id = u.id WHERE mh.message_id = $1 ORDER BY mh.created_at DESC`, [req.params.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/setter/messages/:id', authenticateToken, async (req, res) => {
    const { message_type } = req.body;
    const now = getArgentinaNow().toISO();
    try {
        await db.query('UPDATE messages SET message_type = $1, updated_at = $2 WHERE id = $3 AND setter_id = $4', [message_type, now, req.params.id, req.user.id]);
        res.json({ message: 'Updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Leaderboard ---
app.get('/api/leaderboard', authenticateToken, async (req, res) => {
    const { period } = req.query;
    const now = getArgentinaNow();
    let start;

    if (period === 'today') start = now.startOf('day');
    else if (period === 'week') start = now.startOf('week');
    else if (period === 'month') start = now.startOf('month');
    else return res.status(400).json({ error: 'Invalid period' });

    try {
        const result = await db.query(`SELECT u.real_name, COUNT(m.id) as count FROM users u LEFT JOIN messages m ON u.id = m.setter_id AND m.created_at >= $1 WHERE u.role = 'setter' AND u.is_active = 1 GROUP BY u.id, u.real_name ORDER BY count DESC LIMIT 3`, [start.toISO()]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Admin: Mensajes, Métricas, Export, Backups ---
app.get('/api/admin/messages', authenticateToken, isAdmin, async (req, res) => {
    const { period } = req.query;
    const now = getArgentinaNow();
    let start;
    if (period === 'today') start = now.startOf('day');
    else if (period === 'week') start = now.startOf('week');
    else if (period === 'month') start = now.startOf('month');
    else start = now.minus({ years: 10 });

    try {
        const result = await db.query(`SELECT m.*, u.real_name as setter_name FROM messages m JOIN users u ON m.setter_id = u.id WHERE m.created_at >= $1 ORDER BY m.created_at DESC`, [start.toISO()]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/metrics', authenticateToken, isAdmin, async (req, res) => {
    const { period } = req.query;
    const now = getArgentinaNow();
    let start;
    if (period === 'today') start = now.startOf('day');
    else if (period === 'week') start = now.startOf('week');
    else if (period === 'month') start = now.startOf('month');
    else start = now.minus({ years: 10 });

    try {
        const result = await db.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN message_type = 'sent' THEN 1 END) as sent, COUNT(CASE WHEN message_type = 'responded' THEN 1 END) as responded, COUNT(CASE WHEN message_type = 'call' THEN 1 END) as calls FROM messages WHERE created_at >= $1`, [start.toISO()]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/breakdown/lifetime', authenticateToken, isAdmin, async (req, res) => {
    try {
        const result = await db.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN message_type = 'sent' THEN 1 END) as sent, COUNT(CASE WHEN message_type = 'responded' THEN 1 END) as responded, COUNT(CASE WHEN message_type = 'call' THEN 1 END) as calls FROM messages`);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/setters/:id/messages', authenticateToken, isAdmin, async (req, res) => {
    const { period, type } = req.query;
    const now = getArgentinaNow();
    let conditions = ['setter_id = $1'];
    let params = [req.params.id];
    let idx = 2;

    if (period) {
        let start;
        if (period === 'today') start = now.startOf('day');
        else if (period === 'week') start = now.startOf('week');
        else if (period === 'month') start = now.startOf('month');
        if (start) {
            conditions.push(`created_at >= $${idx}`);
            params.push(start.toISO());
            idx++;
        }
    }
    if (type) {
        conditions.push(`message_type = $${idx}`);
        params.push(type);
        idx++;
    }

    try {
        const result = await db.query(`SELECT * FROM messages WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/setters/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        await db.query('UPDATE users SET is_active = 0 WHERE id = $1', [req.params.id]);
        res.json({ message: 'Setter deactivated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/setters/:id/password', authenticateToken, isAdmin, async (req, res) => {
    const { password } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    try {
        await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
        res.json({ message: 'Password updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/export', authenticateToken, isAdmin, async (req, res) => {
    const { period, setter_id } = req.query;
    const now = getArgentinaNow();
    let conditions = [];
    let params = [];
    let idx = 1;

    if (period) {
        let start;
        if (period === 'today') start = now.startOf('day');
        else if (period === 'week') start = now.startOf('week');
        else if (period === 'month') start = now.startOf('month');
        if (start) {
            conditions.push(`m.created_at >= $${idx}`);
            params.push(start.toISO());
            idx++;
        }
    }
    if (setter_id) {
        conditions.push(`m.setter_id = $${idx}`);
        params.push(setter_id);
        idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
        const result = await db.query(`SELECT m.*, u.real_name as setter_name FROM messages m JOIN users u ON m.setter_id = u.id ${where} ORDER BY m.created_at DESC`, params);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Messages');
        sheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Setter', key: 'setter_name', width: 20 },
            { header: 'Type', key: 'message_type', width: 15 },
            { header: 'Contact', key: 'contact_type', width: 15 },
            { header: 'Value', key: 'contact_value', width: 25 },
            { header: 'Prospect', key: 'prospect_user', width: 20 },
            { header: 'Date', key: 'created_at', width: 25 }
        ];
        result.rows.forEach(row => sheet.addRow(row));

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=export.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/backups', authenticateToken, isAdmin, async (req, res) => {
    try {
        const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.xlsx'));
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/backups/download/:filename', authenticateToken, isAdmin, (req, res) => {
    const filePath = path.join(backupsDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// --- Backup automático diario ---
cron.schedule('0 3 * * *', async () => {
    try {
        const result = await db.query(`SELECT m.*, u.real_name as setter_name FROM messages m JOIN users u ON m.setter_id = u.id ORDER BY m.created_at DESC`);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Backup');
        sheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Setter', key: 'setter_name', width: 20 },
            { header: 'Type', key: 'message_type', width: 15 },
            { header: 'Contact', key: 'contact_type', width: 15 },
            { header: 'Value', key: 'contact_value', width: 25 },
            { header: 'Prospect', key: 'prospect_user', width: 20 },
            { header: 'Date', key: 'created_at', width: 25 }
        ];
        result.rows.forEach(row => sheet.addRow(row));
        const filename = `backup_${DateTime.now().toFormat('yyyy-MM-dd_HHmmss')}.xlsx`;
        await workbook.xlsx.writeFile(path.join(backupsDir, filename));
        console.log(`✅ Backup created: ${filename}`);
    } catch (err) {
        console.error('❌ Backup failed:', err.message);
    }
});

// --- RUTA FINAL PARA LA WEB ---
// Si no es una ruta de API, sirve el index.html
app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send(`Error: No se encontró el index.html en ${frontendPath}. Carpetas detectadas: ${fs.readdirSync(__dirname).join(', ')}`);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📂 Frontend Path: ${frontendPath}`);
});