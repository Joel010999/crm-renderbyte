# Informe Técnico de Replicación - RenderByte CRM

Este documento detalla la estructura, lógica y configuración del proyecto CRM RenderByte para su replicación exacta en un entorno de producción.

## 1. Estructura de Archivos

Vista jerárquica de los componentes principales del proyecto (omitiendo `node_modules`).

```text
CRM.RENDERBYTE.NET/
├── client/                 # Frontend (React + Vite)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── server/                 # Backend (Node.js + Express + SQLite)
│   ├── backups/            # Almacenamiento de backups Excel
│   ├── database.sqlite     # Archivo de base de datos
│   ├── db.js               # Configuración de BD y migraciones
│   ├── index.js            # Punto de entrada del servidor
│   ├── debug_schema.js     # Script de utilidad
│   └── package.json
└── RenderByte_CRM_Hosting.zip
```

---

## 2. Lógica del Servidor (Backend)

Archivo principal: `server/index.js`

Este archivo maneja la API REST, autenticación JWT, conexión a base de datos, tareas programadas (CRON) y generación de reportes Excel.

```javascript
/* CONTENIDO DE SERVER/INDEX.JS */
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

// Ensure backups directory exists
const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir);
}

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

app.use(cors());
app.use(express.json());

// Global logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

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

// ... (Rest of routes and logic as seen in codebase) ...

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
```

> **Nota:** El código completo incluye endpoints para autenticación, gestión de setters, métricas y reportes.

---

## 3. Esquema de Base de Datos (SQLite)

El archivo `database.sqlite` utiliza el siguiente esquema relacional.

### Tabla: `users`
Almacena administradores y operadores (setters).
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    real_name TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'setter')) NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### Tabla: `messages`
Registra las interacciones/mensajes procesados por los setters.
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setter_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    message_type TEXT CHECK(message_type IN ('nuevo', 'seguimiento', 'perdido', 'cliente_potencial')) NOT NULL,
    contact_type TEXT CHECK(contact_type IN ('instagram', 'whatsapp')) NOT NULL,
    contact_value TEXT NOT NULL,
    is_pro INTEGER DEFAULT 0,
    prospect_user TEXT,
    FOREIGN KEY (setter_id) REFERENCES users (id)
);
```

### Tabla: `message_history`
Auditoría de cambios de estado en los mensajes.
```sql
CREATE TABLE message_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    old_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);
```

---

## 4. Dependencias

Versiones exactas extraídas de `package.json`.

### Backend (`server/package.json`)
```json
{
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "better-sqlite3": "^12.6.2",
    "cors": "^2.8.6",
    "dotenv": "^17.2.3",
    "exceljs": "^4.4.0",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.3",
    "luxon": "^3.7.2",
    "node-cron": "^4.2.1"
  }
}
```

### Frontend (`client/package.json`)
```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "lucide-react": "^0.292.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.18.0",
    "framer-motion": "^10.16.4",
    "luxon": "^3.4.4",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "vite": "^5.0.0"
  }
}
```

---

## 5. Configuración de Entorno

Variables requeridas en el archivo `.env` del servidor (`server/.env`):

| Variable | Descripción | Ejemplo (No real) |
| :--- | :--- | :--- |
| `PORT` | Puerto donde corre el servidor | `5000` |
| `JWT_SECRET` | Clave secreta para firmar tokens | `mi_secreto_super_seguro` |

En el frontend (`client/.env` o variables de build):
| Variable | Descripción |
| :--- | :--- |
| `VITE_API_URL` | URL base del backend | `http://localhost:5000/api` |

---

## 6. Flujo de Autenticación

El sistema implementa una autenticación basada en **JWT (JSON Web Tokens)** con roles definidos.

1.  **Login**:
    *   Endpoint: `POST /api/auth/login`
    *   Verificación: Busca usuario por `username`.
    *   **Seguridad**: Compara contraseñas usando **`bcrypt`** (hashing seguro), no texto plano.
    *   Respuesta: Retorna un token JWT firmado con `JWT_SECRET`, válido por 24 horas.

2.  **Protección de Rutas**:
    *   Middleware `authenticateToken`: Verifica la validez del JWT en el header `Authorization: Bearer <token>`.
    *   Middleware `isAdmin`: Verifica si `user.role === 'admin'`.

3.  **Roles**:
    *   `'admin'`: Acceso total (crear usuarios, ver métricas globales, descargar backups, editar cualquier mensaje).
    *   `'setter'`: Acceso limitado (registrar mensajes propios, ver su historial y métricas personales).
