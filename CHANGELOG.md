# Changelog

## [2026-03-30] — WAPI: pausa/reanudación de campañas y fix forzar cierre

### Campañas — backend (`wapi-campanias.service.ts` / `wapi-campanias.controller.ts`)

- **Nuevo método `reanudarCampania(id)`**: valida que la campaña esté en estado `pausada`, re-encola el job en BullMQ y actualiza `pausada: false` + `estado: 'procesando'`. El worker retoma desde el último contacto no enviado gracias al set `yaEnviadosIds` existente.
- **Nuevo endpoint `POST /wapi/campanias/:id/reanudar`**.

### Worker — `wapi-worker.service.ts` / `wapi-worker.ts`

- **Fix: forzar cierre desde el frontend no detenía el worker**. `forzarCierre` en el service solo actualizaba el estado en BD pero el worker activo no lo chequeaba. El loop ahora detecta `estado === 'finalizada'` y `estado === 'error'` (además de `pausada`) y hace `return` inmediato, abortando el envío sin pisar el estado final ya seteado externamente.
- **Fix: logs del worker no visibles en consola**. `createApplicationContext` ahora pasa `logger: ['log', 'warn', 'error', 'debug']` explícitamente para garantizar la salida en cualquier entorno.

### Campañas — frontend (`VerCampaniasWapi.jsx`)

- **Botón pausar (⏸️)** visible en campañas `procesando`, al lado del botón de logs. Llama a `POST /pausar` y recarga la lista.
- **Botón reanudar (▶️)** visible en campañas `pausada`. Llama a `POST /reanudar` y recarga la lista.
- Ambos botones se deshabilitan mientras hay una acción en curso (`accionLoading`).

---

## [2026-03-30] — WAPI: rate limit adaptativo, mejoras de inbox

### Worker de envíos — `wapi-worker.service.ts`

- **Delay por defecto aumentado de 1200ms a 5000ms** para reducir errores `131056` (Spam Rate Limit) de Meta en templates con calidad PENDING.
- **Backoff adaptativo ante rate limits**: cuando la API devuelve códigos `131056`, `130429` o `131048`, el worker espera `backoffMs` (default 60s) y reintenta el mismo contacto una vez antes de continuar.
- **Auto-pausa por errores consecutivos**: si se acumulan `maxErroresConsecutivos` (default 5) errores de rate limit seguidos, la campaña se pausa automáticamente para evitar quemar la calidad del template. Los tres parámetros son configurables por campaña vía `campConfig`.

### Formulario de campaña — `SubirCampaniaWapiModal.jsx`

- **Delay por defecto actualizado a 5000ms** en el formulario de nueva campaña (era 1200ms).

### Inbox — `WapiInbox.jsx`

- **Buscador por ANI, nombre e ID** al tope del panel de conversaciones (estilo WhatsApp Web). Al escribir reemplaza las secciones por una lista "Resultados (N)". Incluye botón X para limpiar.
- **Nueva sección "Resueltas por otros"** (solo admin): muestra conversaciones resueltas por otros asesores para consulta e historial. La sección "Resueltas" se renombró a "Mis resueltas".
- **Chip de ID de contacto** (`#ID`) en el header del chat, copiable al portapapeles con un clic. Permite a los gestores guardar y buscar contactos por ID en sistemas externos. La búsqueda también filtra por ID.
- **Chip de campaña de origen** en el header del chat: muestra el nombre de la campaña desde la que ingresó el contacto (cuando aplica), derivado del mensaje de sistema `ficha_contacto` sin cambios de backend.

---

## [2026-03-21] — WhatsApp API: analítica, métricas y reportes

### Backend

#### Módulo Analítica — `src/modules/wapi/analitica/` *(nuevo)*

- **`wapi-analitica.service.ts`** — Servicio con 5 métodos:
  - `metricasCampania(id)`: conteos por estado (total, enviados, entregados, leídos, fallidos, pendientes, omitidos), tasas (entrega, lectura, fallo), tiempos promedio de entrega y lectura en ms, distribución horaria de lecturas, engagement (respondieron, presionaronBoton, bajas, payloadBreakdown) y agrupación de errores
  - `contactosCampania(id, page, limit, filtro)`: tabla paginada de contactos con 7 filtros (todos, enviados, entregados, leídos, fallidos, respondieron, bajas)
  - `conversacionesCampania(id)`: conversaciones vinculadas a contactos de la campaña con totales por estado
  - `metricasAgentes(desde, hasta)`: KPIs globales del período, estadísticas por agente (asignadas, resueltas, tiempo promedio de primera respuesta, mensajes enviados/recibidos) y evolución diaria
  - `detalleAgente(userId, desde, hasta)`: detalle individual con actividad por hora y por día

- **`wapi-analitica.controller.ts`** — 5 endpoints `GET` bajo `/wapi/analitica`, protegidos con `@RequiredPermiso('wapi.analitica')`:
  - `GET /wapi/analitica/campania/:id`
  - `GET /wapi/analitica/campania/:id/contactos`
  - `GET /wapi/analitica/campania/:id/conversaciones`
  - `GET /wapi/analitica/agentes`
  - `GET /wapi/analitica/agentes/:userId`

- **`wapi-analitica.module.ts`** — Importa `PrismaModule` y `AuthModule` (requerido para `JwtAuthGuard`)

#### Módulo Reportes — `src/modules/wapi/reportes/` *(nuevo)*

- **`wapi-reportes.service.ts`** — Generación de archivos usando `exceljs`:
  - `generarReporteCampaniaCSV(id)`: CSV con todos los contactos de la campaña (estado, timestamps, flags de respuesta/botón/baja)
  - `generarReporteCampaniaExcel(id)`: Excel multi-hoja (Resumen KPIs, Contactos, Errores)
  - `generarReporteBajasCSV()`: CSV global de todas las bajas con campaña, template y fecha
  - `generarReporteAgentesExcel(desde, hasta)`: Excel con KPIs de todos los asesores del período

- **`wapi-reportes.controller.ts`** — 4 endpoints bajo `/wapi/reportes`, protegidos con `wapi.analitica`:
  - `GET /wapi/reportes/campania/:id/csv`
  - `GET /wapi/reportes/campania/:id/excel`
  - `GET /wapi/reportes/bajas/csv`
  - `GET /wapi/reportes/agentes/excel`

- **`wapi-reportes.module.ts`** — Importa `PrismaModule`, `WapiAnaliticaModule` y `AuthModule`

#### Schema — `prisma/schema.prisma`

- **`WaApiConversacion`**: agregados campos `primeraRespuestaAt DateTime?` y `resolvedAt DateTime?` para medir tiempos de respuesta y resolución por asesor
- **`WaApiConversacion`**: `resolverConversacion()` guarda `resolvedAt: new Date()` al resolver
- **`WaApiConversacion`**: `enviarMensaje()` guarda `primeraRespuestaAt` en el primer mensaje saliente del asesor

---

### Frontend

#### `WapiAnalitica.jsx` *(nuevo)* — `src/components/wapi/analitica/`

Contenedor con 3 tabs:
- **Campañas** (`BarChartIcon`)
- **Agentes** (`PeopleIcon`)
- **Reportes** (`DownloadIcon`)

#### `MetricasCampania.jsx` *(nuevo)*

Vista de métricas detalladas por campaña:
- **Lista de campañas**: tabla con nombre, template, fecha de envío y estado; botón para entrar al detalle
- **Vista detallada**:
  - Header con nombre, template, línea, fecha y estado de la campaña
  - **Fila de KPI cards** (ancho completo, `flex: 1`): Total, Enviados, Entregados, Leídos, Fallidos, Omitidos por baja, Avg entrega, Avg lectura — todos en una sola fila que se adapta al ancho disponible
  - **Funnel de campaña**: `BarChart` horizontal (Recharts) con barras coloreadas y `LabelList` mostrando el valor a la derecha de cada barra
  - **Distribución de estados**: `PieChart` donut con leyenda inferior
  - **Distribución horaria de lecturas**: `BarChart` vertical por hora del día
  - **Engagement**: cards de Respondieron / Presionaron botón / Bajas + `BarChart` horizontal de payload breakdown
  - **Tabla de contactos paginada**: 7 chips de filtro, 9 columnas, paginación de 20 registros
  - **Tabla de conversaciones**: con estado, asesor, primera respuesta y fecha de resolución
  - **Acordeón de errores**: agrupados por mensaje de error con conteo

#### `MetricasAgentes.jsx` *(nuevo)*

Métricas de performance por asesor:
- **Selector de período**: desde/hasta con valor por defecto de últimos 30 días
- **KPI globales**: total conversaciones, resueltas, tiempo promedio de primera respuesta, total mensajes
- **Tabla de ranking**: por asesor con columnas de asignadas, resueltas (con % de resolución), tiempo promedio de 1ra respuesta, mensajes enviados/recibidos
- **Gráfico de evolución**: `BarChart` apilado con conversaciones por agente por día
- **Heatmap de actividad**: grilla 7 días × 24 horas con celdas coloreadas por opacidad según nivel de actividad (puro MUI, sin librería extra)
- **Fix**: sort del ranking usa `[...datos.agentes].sort()` para no mutar el estado de React (evita error de propiedad read-only)

#### `WapiReportes.jsx` *(nuevo)*

Generador de reportes con descarga directa:
- **4 cards** de tipos de reporte con selección visual (borde coloreado al seleccionar): Contactos CSV, Reporte Excel, Lista de bajas CSV, Performance agentes Excel
- **Formulario**: `TextField select` para tipo de reporte y campaña (sin layout shift — el de campaña siempre visible, deshabilitado cuando no aplica); `TextField date` para rango de fechas (solo si aplica)
- Descarga via `blob` con nombre de archivo descriptivo

#### `NavBar.jsx` — Nuevo ítem en sección WhatsApp API

- Agregado `{ label: 'Analítica', path: '/wapi/analitica', icon: <InsightsIcon />, permiso: 'wapi.analitica' }`

#### `App.jsx` — Nueva ruta

- `/wapi/analitica` → `WapiAnalitica` con `permiso="wapi.analitica"`

#### `GestionRoles.jsx` — Nuevo permiso

- Agregado `{ key: 'wapi.analitica', label: 'Analítica y reportes' }` en la sección WhatsApp API

#### Tema — `App.jsx`

- Paleta `success` unificada con `primary` en ambos modos: `#075E54` en light, `#075E54` en dark — todos los botones/chips verdes usan el mismo color independientemente del modo

---

## [2026-03-21] — WhatsApp API: multi-línea, inbox completo y notificaciones

### Backend

#### Schema (`prisma/schema.prisma`)

- **`WaApiConfig`**: agregado campo `nombre String?` para identificar cada línea; relación `campanias WaApiCampaña[]`
- **`WaApiTemplate`**: reemplazado `configId Int?` (FK a config) por `wabaId String @default("")`; unique pasó de `@unique` en `metaNombre` a `@@unique([metaNombre, wabaId])` — los templates ahora se asocian al WABA (cuenta Meta) y no al número de teléfono, reflejando la arquitectura real de Meta donde un WABA puede tener múltiples ANIs compartiendo las mismas plantillas
- **`WaApiCampaña`**: agregado `configId Int?` y relación `waConfig WaApiConfig?` para indicar desde qué línea se envía
- **`WaApiConversacion`**: agregada relación explícita `asignadoA Usuario?` para poder incluir datos del asesor asignado en las consultas
- **`Usuario`**: agregada relación inversa `conversaciones WaApiConversacion[]`
- **`WaApiConfig`**: agregados campos `msgBienvenida String? @db.Text` y `msgConfirmacionBaja String? @db.Text` para mensajes automáticos configurables por línea

#### Módulo Config — `src/modules/wapi/config/`

- **`wapi-config.service.ts`** — Reescrito con CRUD completo:
  - `listarConfigs()`: devuelve todas las configs con token/appSecret enmascarados
  - `crearConfig()`, `actualizarConfig()`: alta y modificación de líneas; en update, token y appSecret vacíos no se sobreescriben
  - `eliminarConfig()`, `toggleActivo()`: baja y toggle de estado activo/inactivo
  - `obtenerConfigCompleta(id?)`: uso interno con token real; fallback a primera config activa si no se especifica id
- **`wapi-config.controller.ts`** — CRUD REST completo: `GET /wapi/config`, `GET /wapi/config/:id`, `POST /wapi/config`, `PUT /wapi/config/:id`, `DELETE /wapi/config/:id`, `POST /wapi/config/:id/toggle`
- **`dtos/guardar-wapi-config.dto.ts`** — Agregado campo `nombre` requerido; todos los demás campos opcionales para soportar edición parcial

#### Módulo Templates — `src/modules/wapi/templates/wapi-templates.service.ts`

- `listarTemplates(configId?)`: si viene `configId`, resuelve su `wabaId` y filtra templates por ese WABA; sin filtro devuelve todos
- `sincronizarDesideMeta(configId?)`: upsert usa `{ metaNombre_wabaId }` como clave compuesta; guarda `wabaId` en cada template; múltiples líneas del mismo WABA sincronizan sin duplicar registros

#### Módulo Inbox — `src/modules/wapi/inbox/wapi-inbox.service.ts`

- **Mensajes de bienvenida configurables**: lee `config.msgBienvenida` con fallback al texto hardcodeado por defecto
- **Lógica de reapertura corregida**: conversación se marca `sin_asignar` cuando `estado === 'resuelta'` OR ventana de 24hs vencida; anteriormente solo reabría por ventana vencida
- **Lógica de bienvenida corregida**: desacoplada de la reapertura; ahora se envía solo cuando:
  - Es la primera vez que el contacto escribe (`esNueva`)
  - La ventana de 24hs venció (`ventanaVencida`) — nueva interacción genuina
  - El contacto presionó un botón con acción INBOX (`enviarBienvenidaForzada: true`) — siempre, independientemente de la ventana
  - *No se envía* si la conv estaba resuelta pero el contacto escribe texto libre dentro de las 24hs
- **`MensajeEntranteDto`**: agregado campo opcional `enviarBienvenidaForzada?: boolean`
- **Usuario asignado en respuestas**: todas las queries (`listarConversaciones`, `obtenerConversacion`, `asignarConversacion`, `resolverConversacion`) incluyen `asignadoA: { select: { id, nombre } }` para exponer nombre del asesor

#### Módulo Bajas — `src/modules/wapi/bajas/wapi-bajas.service.ts`

- Mensaje de confirmación de baja lee `config.msgConfirmacionBaja` con fallback al texto por defecto

#### Worker WAPI — `src/workers/wapi-worker.service.ts`

- **Logs en tiempo real**: inyectado `REDIS_CLIENT`; nuevo método `publicarLog()` que publica al canal `campania-log` y persiste en Redis List `campania-wapi-logs:{id}` (últimos 500, TTL 24hs)
- **Progreso en tiempo real**: emite `progreso-envio` por cada contacto procesado
- **Finalización**: emite `campania-finalizada` y `campania-estado` al terminar
- **Multi-config**: usa `campaña.configId` para buscar la config de la campaña; fallback a primera config activa
- **Payload dinámico en botones**: al construir los componentes del template, los placeholders del payload se resuelven por contacto:
  - `{{N}}` → variable del template vía `variableMapping`
  - `{{nombre_columna}}` → columna directa del CSV (cualquier campo subido, esté o no en el template)

#### Webhook — `src/modules/wapi/webhook/wapi-webhook.service.ts`

- Botones con acción INBOX (y botones sin payload configurado) pasan `enviarBienvenidaForzada: true` al inbox, garantizando que el mensaje de bienvenida siempre se envíe al presionar "hablar con asesor"

#### Módulo Logs — `src/modules/campania-logs/campania-logs.controller.ts`

- Agregado soporte para tipo `wapi`: clave Redis `campania-wapi-logs:{id}`

---

### Frontend

#### `WapiConfig.jsx` — Reescrito completo

Pantalla de gestión de líneas WhatsApp API con soporte multi-config:

- **Lista de tarjetas**: muestra todas las líneas configuradas; cada card muestra nombre, Phone Number ID, WABA ID y token enmascarado
- **Chip de estado**: verde "Activa" / gris "Inactiva" por línea
- **Acciones por línea**: toggle activo/inactivo (`PowerSettingsNewIcon`), editar, eliminar
- **Dialog crear/editar**: campos completos — nombre, phoneNumberId, wabaId, token (con ojo), verifyToken, appSecret (con ojo); sección "Mensajes automáticos" con campos multiline para `msgBienvenida` y `msgConfirmacionBaja` editables desde la UI
- Al editar, token y appSecret vacíos no sobreescriben los valores existentes

#### `WapiTemplates.jsx` — Selector de línea y payload dinámico

- **Selector "Filtrar por línea"**: dropdown que filtra templates por el WABA de la config seleccionada (no por config directamente, reflejando que templates son por WABA)
- **Campo "Payload del botón"** en dialog de configuración de botones: editable con helper text explicando sintaxis `{{1}}` (variable template) y `{{nombre_columna}}` (columna CSV directa)

#### `SubirCampaniaWapiModal.jsx` — Selector de línea al crear campaña

- Paso 1 del wizard: si hay más de una config disponible, aparece selector "Línea de envío"
- El `configId` seleccionado se envía al backend al crear la campaña y se usa en el worker para enviar desde esa línea específica

#### `VerCampaniasWapi.jsx` — Progreso y logs en tiempo real

- Barra de progreso (`LinearProgress`) en campañas `procesando`
- Botón `TerminalIcon` para abrir `CampañaLogModal` con `tipo="wapi"`
- Listeners de socket: `campania_finalizada`, `campania_estado`, `campania_error`

#### `WapiInbox.jsx` — Asesor asignado y notificaciones

- **Usuario asignado visible**:
  - En la lista: bajo el nombre de cada conversación aparece `👤 Nombre del asesor` en azul cuando la conv está asignada
  - En el header del chat: chip outlined con ícono de persona y nombre del asesor, al lado del chip de estado
  - Se actualiza en tiempo real vía socket al asignar o resolver
- **Notificaciones del browser** (Web Notifications API):
  - Al montar el componente solicita permiso de notificaciones (mismo comportamiento que WhatsApp Web)
  - Cuando llega un mensaje entrante (`fromMe: false`): notifica si la pestaña no está en foco O si el usuario está viendo una conversación distinta
  - No notifica si el usuario ya está viendo esa conversación con la pestaña activa
  - `tag` por conversación: agrupa mensajes de la misma conv, no genera spam de notificaciones
  - `renotify: true`: actualiza la notificación existente si llega otro mensaje de la misma conv
  - Click en la notificación hace foco en la pestaña del navegador

---

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
