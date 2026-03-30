# AMSA Sender — Plataforma de Comunicaciones Masivas

Plataforma para la gestión de campañas de comunicación multicanal (WhatsApp Business API, WhatsApp Web y Email), con inbox de atención, analítica, reportes y administración de usuarios con roles y permisos.

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Backend | NestJS + TypeScript |
| Frontend | React + Vite + Material UI |
| ORM | Prisma + MySQL |
| Colas | BullMQ + Redis |
| Realtime | Socket.IO |
| Infra | Docker + AWS EC2 (Ubuntu) |
| Logging | Winston |
| Auth | Google OAuth 2.0 + JWT |

---

## Módulos principales

### WhatsApp API (Meta oficial)
- Campañas masivas usando la API oficial de WhatsApp Business (Meta Graph API)
- Templates con variables dinámicas mapeadas desde CSV
- Soporte para botones Quick Reply con payloads dinámicos por contacto
- Worker BullMQ con delay configurable, backoff adaptativo ante rate limits (`131056`, `130429`, `131048`) y auto-pausa por errores consecutivos
- Pausa y reanudación de campañas desde el frontend
- Gestión de múltiples líneas (Phone Number IDs) y múltiples WABA
- Sincronización de templates desde Meta con soporte multi-WABA
- Lista de bajas (opt-out) con supresión en tiempo real durante el envío

### WhatsApp Web (whatsapp-web.js)
- Campañas masivas vía sesiones de WhatsApp Web
- Gestión de múltiples sesiones con persistencia de estado y reconexión automática
- Templates personalizados con formato enriquecido (negrita, cursiva, etc.)
- Progreso de envío en tiempo real vía Socket.IO

### Email
- Campañas con editor Unlayer (drag & drop)
- Gestión de cuentas SMTP propias
- Validación de SPF/DKIM/DMARC
- Envío manual individual sin pasar por campañas
- Lista de desuscripción con supresión automática

### Inbox (WhatsApp API)
- Bandeja de entrada para atención al cliente post-campaña
- Asignación de conversaciones a asesores
- Secciones diferenciadas: mis activas, sin asignar, asignadas a otros (admin), mis resueltas, resueltas por otros (admin)
- Buscador por ANI, nombre o ID de contacto
- Chip de ID copiable y chip de campaña de origen en el header del chat
- Ventana de conversación de 24hs respetando las políticas de Meta
- Envío de texto, imágenes, audio, video y documentos
- Mensaje de bienvenida automático configurable por línea
- Ficha de contacto automática con datos de la campaña de origen
- Notificaciones del browser (Web Notifications API)
- Indicador de escritura en tiempo real

### Analítica y Reportes
- Métricas por campaña: funnel completo (enviados, entregados, leídos, fallidos), distribución horaria, engagement, errores agrupados
- Tabla de contactos paginada con 7 filtros
- KPIs de agentes: conversaciones asignadas/resueltas, tiempo de primera respuesta, actividad por hora/día
- Exportación a CSV y Excel (multi-hoja) para campañas WA, Email, bajas y performance de agentes

### Administración
- Gestión de usuarios (alta, baja, rol, estado activo/inactivo)
- Gestión de roles con permisos granulares por módulo
- Sistema de permisos: `whatsapp.*`, `wapi.*`, `email.*`, `config.*`, `admin.*`
- Autenticación exclusivamente vía Google OAuth (sin contraseñas locales)

---

## Estructura del proyecto

```
amsa-sender/
├── backend/                        → API REST + workers + WebSocket
│   ├── src/
│   │   ├── modules/
│   │   │   ├── wapi/               → WhatsApp API (Meta)
│   │   │   │   ├── campanias/
│   │   │   │   ├── templates/
│   │   │   │   ├── inbox/
│   │   │   │   ├── bajas/
│   │   │   │   ├── config/
│   │   │   │   ├── analitica/
│   │   │   │   └── reportes/
│   │   │   ├── whatsapp/           → WhatsApp Web (whatsapp-web.js)
│   │   │   ├── email/              → Campañas Email
│   │   │   ├── roles/
│   │   │   ├── usuarios/
│   │   │   └── campania-logs/
│   │   ├── workers/                → Procesadores BullMQ
│   │   │   ├── wapi-worker.service.ts
│   │   │   ├── email-worker.service.ts
│   │   │   └── whatsapp-worker.service.ts
│   │   ├── websocket/              → Socket.IO gateway + PubSub Redis
│   │   ├── auth/                   → Google OAuth + JWT + Guards
│   │   └── prisma/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── Dockerfile.backend
│
├── frontend/                       → React + Vite + MUI
│   ├── src/
│   │   ├── components/
│   │   │   ├── wapi/
│   │   │   ├── whatsapp/
│   │   │   ├── email/
│   │   │   └── admin/
│   │   ├── context/                → AuthContext (JWT decode + permisos)
│   │   └── api/                    → Axios con interceptors
│   └── Dockerfile.frontend
│
├── docker-compose.yml
├── CHANGELOG.md
└── README.md
```

---

## Variables de entorno

### `backend/.env`

```env
# Base de datos
DATABASE_URL="mysql://user:password@host:3306/amsa_sender"

# JWT
JWT_SECRET="tu_secret_seguro"

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="https://tudominio.com/api/auth/google/callback"

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# App
PORT=5001
FRONTEND_URL="https://tudominio.com"
```

### `frontend/.env`

```env
VITE_API_URL=https://tudominio.com/api
VITE_HOST_SOCKET=https://tudominio.com
```

---

## Instalación local (desarrollo)

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/amsa-sender.git
cd amsa-sender
```

### 2. Instalar dependencias

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Crear base de datos y migrar

```bash
cd backend
npx prisma migrate dev
npx prisma generate
npx ts-node -r tsconfig-paths/register prisma/seed.ts
```

### 4. Levantar Redis (Docker)

```bash
docker run -d -p 6379:6379 redis:alpine
```

### 5. Iniciar servicios

```bash
# Terminal 1 — API
cd backend && npm run start:dev

# Terminal 2 — Worker WAPI
cd backend && npm run start:wapi-worker

# Terminal 3 — Frontend
cd frontend && npm run dev
```

---

## Despliegue en producción (Docker Compose)

### 1. Preparar el servidor (Ubuntu / AWS EC2)

```bash
sudo apt update
sudo apt install docker.io docker-compose mysql-server
```

### 2. Crear base de datos MySQL

```sql
CREATE DATABASE amsa_sender;
CREATE USER 'amsa_user'@'localhost' IDENTIFIED BY 'password_segura';
GRANT ALL PRIVILEGES ON amsa_sender.* TO 'amsa_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. Aplicar migraciones y seed

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
npx ts-node -r tsconfig-paths/register prisma/seed.ts
```

### 4. Levantar con Docker Compose

```bash
docker-compose up -d --build
```

Servicios expuestos:

| Servicio | Puerto |
|----------|--------|
| Backend API | 5001 |
| Frontend | 80 / 443 |
| Redis | 6379 (interno) |

---

## Scripts útiles

```bash
# Desarrollo
cd backend && npm run start:dev          # API con hot-reload
cd backend && npm run start:wapi-worker  # Worker WhatsApp API
cd frontend && npm run dev               # Frontend con HMR

# Producción
cd backend && npm run build && npm run start:prod
cd frontend && npm run build

# Base de datos
npx prisma migrate deploy                # Aplicar migraciones pendientes
npx prisma studio                        # GUI de base de datos
npx ts-node -r tsconfig-paths/register prisma/seed.ts  # Seed de roles y usuarios

# Logs en producción
docker-compose logs -f backend
docker-compose logs -f frontend
```

---

## Permisos del sistema

| Permiso | Descripción |
|---------|-------------|
| `whatsapp.sesiones` | Gestión de sesiones WhatsApp Web |
| `whatsapp.campanias` | Campañas WhatsApp Web |
| `whatsapp.templates` | Templates WhatsApp Web |
| `wapi.campanias` | Campañas WhatsApp API (Meta) |
| `wapi.templates` | Templates WhatsApp API |
| `wapi.inbox` | Inbox de atención al cliente |
| `wapi.inbox.admin` | Vista admin del inbox (todas las convs) |
| `wapi.analitica` | Analítica y reportes WAPI |
| `email.campanias` | Campañas Email |
| `email.templates` | Templates Email |
| `email.cuentas_smtp` | Gestión de cuentas SMTP |
| `email.envio_manual` | Envío manual de emails |
| `admin.usuarios` | Gestión de usuarios y roles |

---

## Autor

Proyecto desarrollado por **Maximiliano Di Flumeri** para **Ana Maya SA**.
