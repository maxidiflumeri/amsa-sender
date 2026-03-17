# Changelog

## [2026-03-16] — Logs en vivo, detección de campañas trabadas y envío manual de email

### Backend

#### Workers — Logs en tiempo real

- **`workers/whatsapp-worker.service.ts`** — Nuevo método `publicarLog()`:
  - Publica cada evento del worker al canal Redis `campania-log` con nivel (`ok`, `warn`, `error`, `info`, `skip`), mensaje y timestamp
  - Persiste el log en una Redis List `campania-wa-logs:{id}` con `RPUSH` + `LTRIM -500` (últimos 500 logs) + `EXPIRE 86400`
  - Borra la lista al inicio de cada campaña para empezar limpio
  - Logs emitidos en: inicio de campaña, skip de contacto, envío exitoso, error por contacto, pausa, finalización
  - Publica al canal `campania-error` cuando el job falla definitivamente (para detección de trabado)

- **`workers/email-worker.service.ts`** — Mismo patrón con `publicarLog()`:
  - Redis List con clave `campania-email-logs:{id}` (prefijo separado para evitar colisión con IDs de WA)
  - Canal `campania-error` al fallar el job

#### WebSocket / PubSub — `src/websocket/pubsub.service.ts`

- Agregados dos nuevos canales Redis:
  - `campania-log` → emite evento `campania_log` solo a la room `campaña_{id}` (no spam global)
  - `campania-error` → emite evento `campania_error` en broadcast (para detección de trabado en frontend)

#### Módulo de logs — `src/modules/campania-logs/` *(nuevo)*

- **`campania-logs.module.ts`** — Módulo liviano con provider `LOGS_REDIS` (una conexión Redis dedicada para no contaminar los workers)
- **`campania-logs.controller.ts`** — `GET /campania-logs/:id?tipo=wa|email`:
  - Protegido con `JwtAuthGuard`
  - Hace `lRange(key, 0, -1)` y retorna el historial completo parseado como array JSON
  - Permite recuperar hasta los últimos 500 logs al reabrir el modal

---

### Frontend

#### Modal de logs en vivo — `src/components/CampañaLogModal.jsx` *(nuevo)*

Vista estilo terminal de GitLab/CI para seguir el envío de una campaña en tiempo real:

- **Conexión al abrir**: se conecta al socket inmediatamente y comienza a bufferear eventos en `pendientes[]` antes de que llegue el historial
- **Historial**: al montar hace `GET /campania-logs/:id?tipo=wa|email` y carga los últimos 500 logs persistidos en Redis
- **Deduplicación**: los logs del buffer que ya están en el historial se filtran por timestamp para evitar duplicados
- **Colores por nivel**: `ok` → verde, `warn` → amarillo, `error` → rojo, `info` → cyan, `skip` → gris
- **Barra de progreso**: muestra enviados/total tomando el dato real del estado de la campaña en el padre
- **Chips de estadísticas**: contadores de OK / warn / skip / error en tiempo real
- **Auto-scroll**: sigue automáticamente los logs nuevos; botón flotante `↓` para volver al fondo si el usuario scrolleó arriba
- **Máximo 500 logs** en memoria (coincide con el LTRIM de Redis)
- **Acciones del footer**: limpiar vista, descargar `.txt`, Pausar (solo WA), Forzar cierre, Cerrar

#### Detección inteligente de campañas trabadas — `VerCampañas.jsx` / `VerCampañasEmail.jsx`

Antes el botón "Forzar cierre" aparecía en todas las campañas en estado `procesando`. Ahora:

- **`campaniasBloqueadas`** (Set): conjunto de campañas que se consideran genuinamente trabadas
- **Criterio 1 — error del worker**: el evento socket `campania_error` agrega la campaña al set inmediatamente
- **Criterio 2 — timeout de progreso**: un timer de 30 segundos verifica si alguna campaña `procesando` lleva más de 5 minutos sin recibir un evento `progreso` / `progreso_mail`; si supera el umbral, se agrega al set
- Al recibir progreso nuevo o al finalizar/pausar la campaña, se remueve del set
- El botón `BlockIcon` (forzar cierre) solo aparece en campañas del set; el botón `TerminalIcon` (abrir logs) aparece en todas las `procesando`

#### Botón de logs en campañas WA y Email

- **`VerCampañas.jsx`**: botón `TerminalIcon` en campañas `procesando` → abre `CampañaLogModal` con `tipo="wa"` y `progreso` real del padre
- **`VerCampañasEmail.jsx`**: mismo patrón con `tipo="email"` y escucha `progreso_mail`; sin botón de pausa (email no soporta pausa)

#### Envío Manual de Email — `src/components/email/EnvioManual.jsx` *(nuevo)*

Nueva pantalla en la sección Email para enviar un correo individual sin necesidad de crear una campaña:

- Selección de cuenta SMTP origen
- Campos: destinatario, asunto, cuerpo (con soporte HTML o texto plano)
- Envío directo vía API sin pasar por el sistema de colas/workers

---

## [2026-03-16] — Sistema de roles, permisos y gestión de usuarios

### Backend

#### Autenticación — `src/auth/`

- **`auth.service.ts`** — Reemplazado el sistema de whitelist por email por validación contra la base de datos de usuarios:
  - Si el usuario no existe en la BD → `ForbiddenException`
  - Si el usuario tiene `activo: false` → `ForbiddenException`
  - El sistema ya no crea usuarios automáticamente al iniciar sesión; deben ser dados de alta por un admin
  - El JWT ahora incluye el array `permisos: string[]` además de `sub`, `email` y `rol`

- **`auth/permisos.guard.ts`** *(nuevo)* — Guard de NestJS para control de acceso por permiso:
  - Decorator `@RequiredPermiso('clave')` para marcar endpoints con el permiso requerido
  - `PermisosGuard` lee el permiso del reflector y lo valida contra el array del JWT

#### Módulo de Roles — `src/modules/roles/`

- **`roles.service.ts`** *(nuevo)* — Lógica de negocio:
  - `findAll()`: retorna roles con cantidad de usuarios asignados
  - `create()`: crea nuevo rol con nombre y permisos
  - `update()`: actualiza nombre y/o permisos
  - `remove()`: elimina rol; lanza error si tiene usuarios asignados

- **`roles.controller.ts`** *(nuevo)* — `GET/POST/PATCH/DELETE /roles`, protegido con `admin.usuarios`

- **`roles.module.ts`** *(nuevo)*

#### Módulo de Usuarios — `src/modules/usuarios/`

- **`usuarios.service.ts`** *(nuevo)* — Lógica de negocio:
  - `findAll()`: lista todos los usuarios con su rol
  - `create()`: valida unicidad de email y existencia del rol, crea usuario sin contraseña (solo Google)
  - `update()`: actualiza nombre, rol y/o estado activo; sincroniza el campo `rol` string con `rolObj.nombre`
  - `remove()`: previene auto-eliminación (no podés borrar tu propia cuenta)

- **`usuarios.controller.ts`** *(nuevo)* — `GET/POST/PATCH/DELETE /usuarios`, protegido con `admin.usuarios`

- **`usuarios.module.ts`** *(nuevo)*

#### Base de Datos — `prisma/`

- **`schema.prisma`** — Nuevos modelos y campos:
  - Modelo `Rol`: `id`, `nombre` (unique), `permisos Json`, `creadoAt`, relación `usuarios`
  - Modelo `Usuario`: agregados `rolId Int?`, `rolObj Rol?` (relación), `activo Boolean @default(true)`

- **`migrations/20260316215818_add_roles_usuarios`** *(nuevo)* — Migración que crea la tabla `Rol` y agrega las columnas `rolId` y `activo` en `Usuario`

- **`seed.ts`** *(nuevo)* — Seed idempotente (usa `upsert`) que:
  - Crea rol `full` con los 14 permisos del sistema
  - Crea rol `gestor` con 11 permisos (sin `email.cuentas_smtp`, `config.tareas_programadas`, `admin.usuarios`)
  - Asigna `full` a cuentas `@anamayasa.com.ar` y `maxidiflumeri@gmail.com`, `gestor` al resto

  **Permisos del sistema:**
  `whatsapp.sesiones`, `whatsapp.conectar`, `whatsapp.campanias`, `whatsapp.templates`,
  `whatsapp.reportes`, `whatsapp.metricas`, `email.cuentas_smtp`, `email.templates`,
  `email.campanias`, `email.envio_manual`, `email.reportes`, `email.desuscripciones`,
  `config.tareas_programadas`, `admin.usuarios`

#### Configuración

- **`app.module.ts`** — Registrados `RolesModule` y `UsuariosModule`

- **`tsconfig.build.json`** — Agregado `"prisma"` al array `exclude` para evitar que el compilador
  infiera `rootDir` como `./` en lugar de `./src` (lo que causaba que el build saliera a `dist/src/`
  en vez de `dist/`)

---

### Frontend

#### Contexto de autenticación — `src/context/AuthContext.jsx` *(nuevo)*

- Decodifica el JWT desde `localStorage` sin dependencias externas (base64 nativo)
- Provee `hasPermiso(key: string): boolean` y el payload del usuario decodificado
- `AuthProvider` envuelve la app; `useAuth()` hook para consumir el contexto

#### App — `src/App.jsx`

- Envuelto con `<AuthProvider>`
- Agregadas rutas privadas `/admin/usuarios` → `GestionUsuarios` y `/admin/roles` → `GestionRoles`

#### NavBar — `src/components/NavBar.jsx`

- Todos los ítems del menú tienen ahora una propiedad `permiso` asociada
- Cada ítem se filtra con `hasPermiso()`: si el usuario no tiene el permiso, el ítem no aparece
- Cada sección (WhatsApp, Email, Configuración, Admin) se oculta completamente si el usuario no tiene
  ningún permiso de esa categoría
- Nueva sección **Admin** (visible solo con `admin.usuarios`) con accesos a Usuarios y Roles

#### Gestión de Usuarios — `src/components/admin/GestionUsuarios.jsx` *(nuevo)*

- Tabla con todos los usuarios: nombre, email, rol, estado (activo/suspendido)
- **Crear usuario**: email, nombre, rol — el usuario debe existir previamente para poder iniciar sesión con Google
- **Editar usuario**: cambiar nombre, rol y activar/suspender cuenta con un switch
- **Eliminar usuario**: confirmación previa; el backend previene la auto-eliminación

#### Gestión de Roles — `src/components/admin/GestionRoles.jsx` *(nuevo)*

- **Vista principal rediseñada** — Cards modernas con:
  - Barra de acento superior con color dinámico según nivel de acceso
  - Ícono de escudo con fondo coloreado, nombre del rol y cantidad de usuarios asignados
  - Chip `X/14` con total de permisos habilitados
  - Barra de progreso con porcentaje de acceso total
  - Filas por sección (WhatsApp / Email / Config / Admin) con íconos y puntos de color
    que indican visualmente qué permisos están activos en cada categoría
  - Soporte completo para modo oscuro

- **Editor de permisos** — Checkboxes agrupados por sección con checkbox maestro por categoría
  (con estado intermedio cuando solo algunos están activos), usado en los dialogs de crear y editar

- **Crear / Editar / Eliminar** roles con validaciones y feedback de error inline

#### Login — `src/components/Login.jsx`

- Actualizado el mensaje de error de acceso denegado: ya no menciona `@anamayasa.com.ar`
  exclusivamente; ahora indica que el admin debe dar de alta al usuario

---

### Comandos para deployar en producción

```bash
# 1. Aplicar migración de BD
npx prisma migrate deploy

# 2. Ejecutar seed (idempotente)
npx ts-node -r tsconfig-paths/register prisma/seed.ts

# 3. Build y arranque
npm run build
npm run prod
```
