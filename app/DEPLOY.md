# RenderByte CRM - Deployment Guide (Ubuntu + Apache)

## Estructura de la Carpeta `app`
```
app/
├── public/          # Frontend compilado (servido por Apache)
│   ├── index.html
│   └── assets/
├── server/          # Backend Node.js (API)
│   ├── index.js
│   ├── db.js
│   ├── seed.js
│   ├── package.json
│   └── .env
└── DEPLOY.md        # Este archivo
```

## Paso 1: Subir la carpeta `app` al servidor

Usa `scp` o `rsync` para subir la carpeta:
```bash
scp -r app/ usuario@tu-servidor:/var/www/renderbyte/
```

## Paso 2: Configurar el Backend (Node.js)

En el servidor Ubuntu:
```bash
cd /var/www/renderbyte/server
npm install
node seed.js  # Crea usuarios admin/test
```

Instalar PM2 para mantener el servidor corriendo:
```bash
sudo npm install -g pm2
pm2 start index.js --name renderbyte-api
pm2 save
pm2 startup
```

## Paso 3: Configurar Apache

### Habilitar módulos necesarios:
```bash
sudo a2enmod proxy proxy_http rewrite
sudo systemctl restart apache2
```

### Crear VirtualHost:
```bash
sudo nano /etc/apache2/sites-available/renderbyte.conf
```

Contenido:
```apache
<VirtualHost *:80>
    ServerName tu-dominio.com
    DocumentRoot /var/www/renderbyte/public

    <Directory /var/www/renderbyte/public>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # API Proxy (redirige /api al backend Node.js)
    ProxyPreserveHost On
    ProxyPass /api http://127.0.0.1:5000/api
    ProxyPassReverse /api http://127.0.0.1:5000/api

    # SPA Fallback (React Router)
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/api
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ /index.html [L]

    ErrorLog ${APACHE_LOG_DIR}/renderbyte_error.log
    CustomLog ${APACHE_LOG_DIR}/renderbyte_access.log combined
</VirtualHost>
```

### Activar el sitio:
```bash
sudo a2ensite renderbyte.conf
sudo systemctl reload apache2
```

## Paso 4: Configurar .env para Producción

Editar `/var/www/renderbyte/server/.env`:
```
JWT_SECRET=UNA_CLAVE_SEGURA_MUY_LARGA_123
PORT=5000
```

## Paso 5: Verificar

1. Backend: `curl http://localhost:5000/api/me` (debería dar 401)
2. Frontend: Abrir `http://tu-dominio.com` en el navegador

## Credenciales Iniciales

| Rol | Usuario | Contraseña |
|-----|---------|------------|
| Admin | admin | admin123 |
| Setter | test | test123 |
