
# 📲 WhatsApp Automation – Sistema de Envío Masivo por WhatsApp

Este proyecto es una plataforma completa para gestionar el envío automatizado y controlado de mensajes por WhatsApp utilizando sesiones activas y la librería `whatsapp-web.js`. Incluye funcionalidades de administración de campañas, plantillas con datos personalizados, programación de envíos, manejo de sesiones y más.

---

## 🚀 Funcionalidades Principales

- **Gestión de campañas** con estado: pendiente, procesando, pausada, finalizada, agendada.
- **Carga de contactos vía CSV** y vista previa de los datos.
- **Creación de templates personalizados** con variables dinámicas.
- **Formato enriquecido compatible con WhatsApp** (negrita, cursiva, salto de línea, etc.).
- **Programación de campañas** en fecha y hora específicas.
- **Envío en segundo plano con BullMQ** (Redis) para control por lotes, con parámetros configurables.
- **Monitoreo en tiempo real** del estado de envío mediante Socket.IO.
- **Gestión de múltiples sesiones WhatsApp**, persistencia de estado, reconexión automática.
- **UI moderna** en React con soporte para modo oscuro y experiencia de usuario optimizada.

---

## 🛠 Tecnologías Utilizadas

- **Frontend:** React + Vite + Material UI
- **Backend:** Node.js + Express + Prisma ORM
- **Base de datos:** MySQL (instancia externa en el mismo servidor)
- **Cola de procesamiento:** Redis + BullMQ
- **WebSocket:** Socket.IO
- **WhatsApp Client:** whatsapp-web.js

---

## 📦 Estructura del Proyecto

```
whatsapp-automation/
│
├── backend/                   → API REST + workers + Prisma + Socket.IO
│   ├── src/
│   ├── prisma/
│   └── Dockerfile.backend     → Imagen de backend para producción
│
├── frontend/                  → Interfaz React + Vite + MUI
│   └── Dockerfile.frontend    → Imagen de frontend para producción
│
├── docker-compose.yml         → Orquesta backend, frontend y Redis
└── README.md
```

---

## ⚙️ Requisitos

- Docker + Docker Compose
- Node.js 18+ (solo para desarrollo local)
- Redis (contenedor incluido)
- MySQL instalado en el mismo servidor (por fuera de Docker)

---

## 🧪 Instalación local (modo desarrollo)

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/whatsapp-automation.git
cd whatsapp-automation
```

### 2. Instalar dependencias

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Crear base de datos (modo desarrollo)

Asegurate de tener MySQL corriendo. Luego:

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

---

## 🚀 Despliegue en producción

### 1. Instalar MySQL en el servidor (si no está instalado)

```bash
sudo apt update
sudo apt install mysql-server
```

### 2. Crear la base de datos y usuario en MySQL

```bash
sudo mysql -u root
```

```sql
CREATE DATABASE whatsapp_automation;
CREATE USER 'wa_user'@'localhost' IDENTIFIED BY 'tu_password_segura';
GRANT ALL PRIVILEGES ON whatsapp_automation.* TO 'wa_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

### 3. Crear `.env` para backend y frontend

#### backend/.env

```env
DATABASE_URL="mysql://wa_user:tu_password_segura@localhost:3306/whatsapp_automation"
PORT=3001
```

#### frontend/.env

```env
VITE_API_URL=http://localhost:3001
```

---

### 4. Inicializar la base de datos con Prisma (desde el servidor)

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma generate
```

---

### 5. Ejecutar la app con Docker Compose

```bash
docker-compose up -d --build
```

Esto levanta:

- Backend en `http://localhost:3001`
- Frontend en `http://localhost:5173`
- Redis

> El backend se conecta a la base de datos externa configurada en `.env`.

---

### 6. ¡Listo para usar!

Accedé al frontend, conectá una sesión de WhatsApp escaneando el QR, cargá contactos y comenzá a enviar campañas.

---

## 🧰 Scripts útiles

```bash
# Ejecutar backend local
cd backend && npm run dev

# Ejecutar frontend local
cd frontend && npm run dev

# Compilar producción frontend
cd frontend && npm run build
```

---

## ✉️ Contacto

Proyecto desarrollado por **Maximiliano Di Flumeri**

- Email: [tu-email]
- GitHub: [tu-usuario]

---
