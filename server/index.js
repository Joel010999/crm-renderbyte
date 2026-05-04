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

// --- FUNCIÓN DE AUTO-CREACIÓN DE ADMIN (Postgres) ---
const seedAdmin = async () => {
    const adminUsername = 'joel_admin';
    const adminPassword = 'admin73152';

    try {
        // Reseteo de seguridad para asegurar acceso
        await db.query('DELETE FROM users WHERE username = $1', [adminUsername]);

        const hash = bcrypt.hashSync(adminPassword, 10);
        const now = getArgentinaNow().toISO();

        await db.query(`
            INSERT INTO users (username, password_hash, real_name, role, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 1, $5, $6)
        `, [adminUsername, hash, 'Joel', 'admin', now, now]);

        console.log('✅ ADMIN RESETEADO: Usuario "joel_admin" creado con éxito en Postgres.');
    } catch (error) {
        console.error('❌ Error en el seed de Postgres:', error.message);
    }
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
app.get('/api/admin/setters', authenticateToken, isAdmin, async (req, res) => {
    try {
        // Crucial: Traemos todos los activos para que el dashboard no crashee al buscar el admin
        const result = await db.query(`SELECT id, username, real_name, role, is_active, created_at FROM users WHERE is_active = 1`);
        const users = result.rows;
        const now = getArgentinaNow();
        const tStart = now.startOf('day').toISO();
        const wStart = now.startOf('week').toISO();
        const mStart = now.startOf('month').toISO();

        const enrichedUsers = [];
        for (const u of users) {
            const stats = await db.query(`
                SELECT 
                    COUNT(CASE WHEN created_at >= $1 THEN 1 END) as today, 
                    COUNT(CASE WHEN created_at >= $2 THEN 1 END) as week, 
                    COUNT(CASE WHEN created_at >= $3 THEN 1 END) as month 
                FROM messages WHERE setter_id = $4
            `, [tStart, wStart, mStart, u.id]);
            enrichedUsers.push({ ...u, ...stats.rows[0] });
        }
        res.json(enrichedUsers);
    } catch (err) {
        console.error("Error en setters:", err.message);
        res.json([]); // Evita pantalla negra si falla la query
    }
});

app.post('/api/admin/setters', authenticateToken, isAdmin, async (req, res) => {
    const { username, password, real_name } = req.body;
    const now = getArgentinaNow().toISO();
    try {
        const passwordHash = bcrypt.hashSync(password, 10);
        await db.query(`INSERT INTO users (username, password_hash, real_name, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, 'setter', 1, $4, $5)`, [username, passwordHash, real_name, now, now]);
        res.status(201).json({ message: 'Setter created successfully' });
    } catch (error) {
        if (error.code === '23505') return res.status(400).json({ error: 'Username already exists' });
        res.status(500).json({ error: error.message });
    }
});

// --- Rutas de Setters y Mensajes ---
app.post('/api/setter/messages', authenticateToken, async (req, res) => {
    const { message_type, contact_type, contact_value, prospect_user } = req.body;
    const now = getArgentinaNow().toISO();
    try {
        await db.query(`INSERT INTO messages (setter_id, created_at, message_type, contact_type, contact_value, prospect_user, is_pro) VALUES ($1, $2, $3, $4, $5, $6, 0)`, [req.user.id, now, message_type, contact_type, contact_value, prospect_user || '']);
        res.status(201).json({ message: 'Message logged' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/setter/metrics', authenticateToken, async (req, res) => {
    const now = getArgentinaNow();
    const tStart = now.startOf('day').toISO();
    const wStart = now.startOf('week').toISO();
    const mStart = now.startOf('month').toISO();
    try {
        const stats = await db.query(`SELECT COUNT(CASE WHEN created_at >= $1 THEN 1 END) as today, COUNT(CASE WHEN created_at >= $2 THEN 1 END) as week, COUNT(CASE WHEN created_at >= $3 THEN 1 END) as month, COUNT(*) as total FROM messages WHERE setter_id = $4`, [tStart, wStart, mStart, req.user.id]);
        res.json(stats.rows[0] || { today: 0, week: 0, month: 0, total: 0 });
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
        let start = period === 'today' ? now.startOf('day') : (period === 'week' ? now.startOf('week') : now.startOf('month'));
        conditions.push(`created_at >= $${idx}`);
        params.push(start.toISO());
        idx++;
    }
    if (type) {
        conditions.push(`message_type = $${idx}`);
        params.push(type);
    }

    try {
        const result = await db.query(`SELECT * FROM messages WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Admin: Métricas Globales y Exportación ---
app.get('/api/admin/metrics', authenticateToken, isAdmin, async (req, res) => {
    const { period } = req.query;
    const now = getArgentinaNow();
    let start = period === 'today' ? now.startOf('day') : (period === 'week' ? now.startOf('week') : (period === 'month' ? now.startOf('month') : now.minus({ years: 10 })));

    try {
        const result = await db.query(`SELECT COUNT(*) as total, COUNT(CASE WHEN message_type = 'sent' THEN 1 END) as sent, COUNT(CASE WHEN message_type = 'responded' THEN 1 END) as responded, COUNT(CASE WHEN message_type = 'call' THEN 1 END) as calls FROM messages WHERE created_at >= $1`, [start.toISO()]);
        res.json(result.rows[0] || { total: 0, sent: 0, responded: 0, calls: 0 });
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
        let start = period === 'today' ? now.startOf('day') : (period === 'week' ? now.startOf('week') : now.startOf('month'));
        conditions.push(`m.created_at >= $${idx}`);
        params.push(start.toISO());
        idx++;
    }
    if (setter_id) {
        conditions.push(`m.setter_id = $${idx}`);
        params.push(setter_id);
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
            { header: 'Value', key: 'contact_value', width: 25 },
            { header: 'Prospect', key: 'prospect_user', width: 20 },
            { header: 'Date', key: 'created_at', width: 25 }
        ];
        result.rows.forEach(row => sheet.addRow(row));
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=renderbyte_export.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Backups Automáticos (Cron cada día a las 03:00) ---
cron.schedule('0 3 * * *', async () => {
    try {
        const result = await db.query(`SELECT m.*, u.real_name as setter_name FROM messages m JOIN users u ON m.setter_id = u.id ORDER BY m.created_at DESC`);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Backup');
        sheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Setter', key: 'setter_name', width: 20 },
            { header: 'Type', key: 'message_type', width: 15 },
            { header: 'Date', key: 'created_at', width: 25 }
        ];
        result.rows.forEach(row => sheet.addRow(row));
        const filename = `backup_${DateTime.now().toFormat('yyyy-MM-dd_HHmmss')}.xlsx`;
        await workbook.xlsx.writeFile(path.join(backupsDir, filename));
        console.log(`✅ Backup automático creado: ${filename}`);
    } catch (err) {
        console.error('❌ Falló el backup automático:', err.message);
    }
});

// --- Líderes y Status ---
app.get('/api/leaderboard', authenticateToken, async (req, res) => {
    const { period } = req.query;
    const now = getArgentinaNow();
    let start = period === 'today' ? now.startOf('day') : (period === 'week' ? now.startOf('week') : now.startOf('month'));
    try {
        const result = await db.query(`SELECT u.real_name, COUNT(m.id) as count FROM users u LEFT JOIN messages m ON u.id = m.setter_id AND m.created_at >= $1 WHERE u.role = 'setter' AND u.is_active = 1 GROUP BY u.id, u.real_name ORDER BY count DESC LIMIT 3`, [start.toISO()]);
        res.json(result.rows);
    } catch (err) {
        res.json([]);
    }
});

// --- Fallback para Frontend ---
app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Error: Frontend dist no encontrado.");
    }
});

app.listen(PORT, '0.0.0.0', async () => {
    await seedAdmin();
    console.log(`🚀 RenderByte Server corriendo en puerto ${PORT}`);
});