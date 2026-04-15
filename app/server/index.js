const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { DateTime } = require('luxon');
const ExcelJS = require('exceljs');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

app.use(cors());
app.use(express.json());

// Helper for Argentina Time
const getArgentinaNow = () => DateTime.now().setZone('America/Argentina/Cordoba');

// --- Middleware ---
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

// --- Auth Routes ---
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, real_name: user.real_name },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, username: user.username, role: user.role, real_name: user.real_name } });
});

app.get('/api/me', authenticateToken, (req, res) => {
    res.json(req.user);
});

// --- Admin: Setter Management ---
app.post('/api/admin/setters', authenticateToken, isAdmin, (req, res) => {
    const { username, password, real_name } = req.body;
    const now = getArgentinaNow().toISO();

    try {
        const passwordHash = bcrypt.hashSync(password, 10);
        db.prepare(`
      INSERT INTO users (username, password_hash, real_name, role, created_at, updated_at)
      VALUES (?, ?, ?, 'setter', ?, ?)
    `).run(username, passwordHash, real_name, now, now);
        res.status(201).json({ message: 'Setter created successfully' });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/setters', authenticateToken, isAdmin, (req, res) => {
    const setters = db.prepare(`
    SELECT id, username, real_name, is_active, created_at 
    FROM users 
    WHERE role = 'setter' AND is_active = 1
  `).all();

    const now = getArgentinaNow();
    const todayStart = now.startOf('day').toISO();
    const weekStart = now.startOf('week').toISO();
    const monthStart = now.startOf('month').toISO();

    const enrichedSetters = setters.map(s => {
        const stats = db.prepare(`
      SELECT 
        COUNT(CASE WHEN created_at >= ? THEN 1 END) as today,
        COUNT(CASE WHEN created_at >= ? THEN 1 END) as week,
        COUNT(CASE WHEN created_at >= ? THEN 1 END) as month
      FROM messages 
      WHERE setter_id = ?
    `).get(todayStart, weekStart, monthStart, s.id);
        return { ...s, ...stats };
    });

    res.json(enrichedSetters);
});

app.patch('/api/admin/setters/:id', authenticateToken, isAdmin, (req, res) => {
    const { username, real_name } = req.body;
    const now = getArgentinaNow().toISO();
    db.prepare('UPDATE users SET username = ?, real_name = ?, updated_at = ? WHERE id = ?')
        .run(username, real_name, now, req.params.id);
    res.json({ message: 'User updated' });
});

app.post('/api/admin/setters/:id/password', authenticateToken, isAdmin, (req, res) => {
    const { password } = req.body;
    const passwordHash = bcrypt.hashSync(password, 10);
    const now = getArgentinaNow().toISO();
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
        .run(passwordHash, now, req.params.id);
    res.json({ message: 'Password updated' });
});

app.delete('/api/admin/setters/:id', authenticateToken, isAdmin, (req, res) => {
    const now = getArgentinaNow().toISO();
    db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?')
        .run(now, req.params.id);
    res.json({ message: 'Setter deactivated' });
});

// --- Admin: Metrics & Monitoring ---
app.get('/api/admin/metrics', authenticateToken, isAdmin, (req, res) => {
    const { period } = req.query; // today, week, month
    const now = getArgentinaNow();
    let start;

    if (period === 'today') start = now.startOf('day');
    else if (period === 'week') start = now.startOf('week');
    else if (period === 'month') start = now.startOf('month');
    else return res.status(400).json({ error: 'Invalid period' });

    const startISO = start.toISO();
    const stats = db.prepare(`
    SELECT message_type as type, COUNT(*) as count 
    FROM messages 
    WHERE created_at >= ? 
    GROUP BY message_type
  `).all(startISO);

    const total = stats.reduce((acc, curr) => acc + curr.count, 0);
    res.json({ total, breakdown: stats });
});

app.get('/api/admin/breakdown/lifetime', authenticateToken, isAdmin, (req, res) => {
    const stats = db.prepare(`
    SELECT message_type as type, COUNT(*) as count 
    FROM messages 
    GROUP BY message_type
  `).all();
    res.json(stats);
});

// Get all messages for a period with setter info
app.get('/api/admin/messages', authenticateToken, isAdmin, (req, res) => {
    const { period } = req.query;
    const now = getArgentinaNow();
    let start;

    if (period === 'today') start = now.startOf('day');
    else if (period === 'week') start = now.startOf('week');
    else if (period === 'month') start = now.startOf('month');
    else return res.status(400).json({ error: 'Invalid period' });

    const startISO = start.toISO();

    const messages = db.prepare(`
        SELECT m.*, u.real_name as setter_name, u.username as setter_username
        FROM messages m
        JOIN users u ON m.setter_id = u.id
        WHERE m.created_at >= ?
        ORDER BY m.created_at DESC
    `).all(startISO);

    // Group by type for breakdown
    const breakdown = db.prepare(`
        SELECT message_type as type, COUNT(*) as count 
        FROM messages 
        WHERE created_at >= ? 
        GROUP BY message_type
    `).all(startISO);

    res.json({
        messages,
        breakdown,
        total: messages.length,
        periodStart: startISO,
        periodEnd: now.toISO()
    });
});

app.get('/api/admin/setters/:id/messages', authenticateToken, isAdmin, (req, res) => {
    const { type, startDate, endDate } = req.query;
    let query = 'SELECT * FROM messages WHERE setter_id = ?';
    const params = [req.params.id];

    if (type) {
        query += ' AND message_type = ?';
        params.push(type);
    }
    if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate);
    }
    query += ' ORDER BY created_at DESC';

    const messages = db.prepare(query).all(...params);
    res.json(messages);
});

// --- Admin: Export Excel ---
app.get('/api/admin/export', authenticateToken, isAdmin, async (req, res) => {
    const { setterId, startDate, endDate } = req.query;
    let query = `
    SELECT m.*, u.real_name, u.username 
    FROM messages m
    JOIN users u ON m.setter_id = u.id
    WHERE 1=1
  `;
    const params = [];

    if (setterId) {
        query += ' AND m.setter_id = ?';
        params.push(setterId);
    }
    if (startDate) {
        query += ' AND m.created_at >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND m.created_at <= ?';
        params.push(endDate);
    }
    query += ' ORDER BY m.created_at DESC';

    const data = db.prepare(query).all(...params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Messages');

    worksheet.columns = [
        { header: 'Created At (Arg)', key: 'created_at', width: 25 },
        { header: 'Setter Name', key: 'real_name', width: 20 },
        { header: 'Setter Username', key: 'username', width: 15 },
        { header: 'Type', key: 'message_type', width: 15 },
        { header: 'Contact Type', key: 'contact_type', width: 15 },
        { header: 'Contact Value', key: 'contact_value', width: 25 },
    ];

    data.forEach(row => {
        worksheet.addRow({
            created_at: DateTime.fromISO(row.created_at).setZone('America/Argentina/Cordoba').toFormat('yyyy-MM-dd HH:mm:ss'),
            real_name: row.real_name,
            username: row.username,
            message_type: row.message_type,
            contact_type: row.contact_type,
            contact_value: row.contact_value
        });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=renderbyte_export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
});

// --- Setter Routes ---
app.post('/api/setter/messages', authenticateToken, (req, res) => {
    const { message_type, contact_type, contact_value } = req.body;
    const now = getArgentinaNow().toISO();

    db.prepare(`
    INSERT INTO messages (setter_id, created_at, message_type, contact_type, contact_value)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, now, message_type, contact_type, contact_value);

    res.status(201).json({ message: 'Message logged' });
});

app.get('/api/setter/messages', authenticateToken, (req, res) => {
    const { type, search } = req.query;
    let query = 'SELECT * FROM messages WHERE setter_id = ?';
    const params = [req.user.id];

    if (type) {
        query += ' AND message_type = ?';
        params.push(type);
    }
    if (search) {
        query += ' AND contact_value LIKE ?';
        params.push(`%${search}%`);
    }
    query += ' ORDER BY created_at DESC LIMIT 100';

    const messages = db.prepare(query).all(...params);
    res.json(messages);
});

// --- Global: Leaderboard ---
app.get('/api/leaderboard', authenticateToken, (req, res) => {
    const { period } = req.query;
    const now = getArgentinaNow();
    let start;

    if (period === 'today') start = now.startOf('day');
    else if (period === 'week') start = now.startOf('week');
    else if (period === 'month') start = now.startOf('month');
    else return res.status(400).json({ error: 'Invalid period' });

    const startISO = start.toISO();
    const top3 = db.prepare(`
    SELECT u.real_name, COUNT(m.id) as count
    FROM users u
    LEFT JOIN messages m ON u.id = m.setter_id AND m.created_at >= ?
    WHERE u.role = 'setter' AND u.is_active = 1
    GROUP BY u.id
    ORDER BY count DESC
    LIMIT 3
  `).all(startISO);

    res.json(top3);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
