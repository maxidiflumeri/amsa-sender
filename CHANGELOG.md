# Changelog

## [2026-10-23] — Campañas de WhatsApp Web: la pausa que quedaba trabada

### Contexto

La campaña #513 («Hogar_7086_c1_$90_$100», del 24/04) figuraba en pausa y no se podía reanudar ni eliminar. Estaba en
`pausa_pendiente` sin ningún job en la cola, con 49 de 85 contactos intentados. `pausarCampaña` ponía `pausa_pendiente`
a cualquier campaña que no estuviera `procesando`, pensando en una agendada cuyo job todavía no arrancó (el worker la pasa
a `pausada` al arrancar). Una segunda pausa sobre una ya `pausada` (doble toque, la lista y el log a la vez) caía ahí:
si el envío ya se había detenido, ningún job la sacaba nunca; si seguía enviando, el worker no la toma como pausa (mira
solo `pausada`) y mandaba todo. Reanudar solo aceptaba `pausada` y la lista no ofrecía acciones para ese estado.

### Backend (`campanias.service.ts`)

- **Pausar** una `pausada` o `pausa_pendiente` no hace nada; `pausa_pendiente` queda solo para una `programada`; una
  `pendiente`, `finalizada` o `error` responde 400.
- **Reanudar** acepta `pausada` y `pausa_pendiente`. Si la campaña tiene un job que todavía no arrancó (`delayed` o
  `waiting`), le devuelve el estado (`programada` o `procesando`) en vez de encolar otro, que la mandaría dos veces.
- **Elegir la línea al reanudar**: una línea que se vuelve a conectar queda con otro id de sesión, y la campaña seguía
  apuntando a la vieja (pasó con la #630 el mismo día, y había que corregirla en la base). Reanudar se queda solo con las
  sesiones conectadas (según la tabla `Sesion`); si no queda ninguna responde 400 con `codigo: 'SIN_SESIONES_CONECTADAS'`
  sin encolar nada. Acepta `sessionIds` en el cuerpo para seguir con otras, y las guarda en la campaña.
- `campanias.service.spec.ts`: era un placeholder que fallaba; ahora 20 pruebas de pausa y reanudación.

### Reanudar dejaba la campaña "enviando" sin job (WhatsApp API y WhatsApp Web)

Al reanudar las campañas después del deploy de las 16:20, la #707 de WhatsApp API quedó en `procesando` sin job: 45 de
73, sin enviar nada. En los logs, a las 16:22:05 el worker toma su job ("28 pendientes de 73") y en el mismo milisegundo
corta con "Campaña 707 pausada". Los dos `reanudar` encolaban el job **antes** de sacar la campaña de la pausa en la base;
con el worker libre, el job arranca antes que ese `update`, ve `pausada` y termina sin enviar. Ahora primero se actualiza
el estado y después se encola; si encolar falla, la campaña vuelve a la pausa. La #704 no se vio afectada porque su job
quedó esperando detrás del de la #707. `wapi-campanias.service.spec.ts` (nuevo) y dos pruebas más en el de WhatsApp Web.
La #707 se recupera pausándola y reanudándola con el backend nuevo.

### Frontend

- `pausa_pendiente` se muestra «En pausa» (antes «Pausando», con el punto que late) y tiene las acciones de una pausada:
  Reanudar y Eliminar.
- `DialogoElegirSesiones`: si al reanudar el backend responde `SIN_SESIONES_CONECTADAS`, se abre para elegir con qué
  sesiones seguir; se actualiza solo si una sesión se conecta o se cae con el diálogo abierto.

### Deploy

Eliminar ya funciona con el frontend solo (el backend actual solo bloquea eliminar una `procesando`). Reanudar una
`pausa_pendiente` y elegir la línea necesitan el backend nuevo, que se despliega a mano con el procedimiento de siempre:
sin campañas enviando, colas vacías.

## [2026-10-23] — Sender v2: de la misma familia que Gestión, pensado para el celular y como app instalada

### Contexto

El usuario pidió una versión 2 de la interfaz con los mismos lineamientos que AMSA Gestión, que estrenó marco nuevo el
22/10. Su condición: **"que uno vea una plataforma y la otra y diga: son de la misma empresa"**, conservando cada una su
color (Sender su verde, Gestión su azul). Además, 100% usable en el celular y como PWA, porque Conversaciones se atiende
desde el teléfono. La propuesta, con el relevamiento de las 36 rutas y las maquetas, está en el lienzo
https://claude.ai/artifact/GPeQrtau7EUiRVKAzPRvtU.

Decisiones del usuario: barra de abajo en el celular sí; WhatsApp Web se sigue usando (va completo); el logo es la A de
Gestión en el verde de Sender; notificaciones push sí; marco neutro, igual que Gestión. Las reglas de interfaz quedaron
en [docs/sender-v2-guia-ui.md](docs/sender-v2-guia-ui.md).

### Base (frontend)

- **Tema único** (`src/theme/`): los tokens de Gestión con el acento verde (`#075E54` claro, `#25D366` oscuro). Antes
  había dos temas (`theme.js` quedaba tapado por el de `App.jsx`) y `primary` y `success` eran el mismo verde. Inter
  (`@fontsource/inter`), íconos Lucide (`lucide-react` 1.52.0, la misma versión exacta que Gestión), sombras y escala
  tipográfica de Gestión, `esES` de MUI, campos de 16 px debajo de `sm` (iOS no hace zoom).
- **Tema Claro / Oscuro / Sistema** (`ColorModeContext`), con la misma clave `themeMode` de antes. Pinta la barra del
  sistema del celular (`theme-color`).
- **El marco** (`src/components/layout/`): barra y menú lateral sobre `background.marco`, la pantalla en un panel
  redondeado desde `md`; menú por bloques (Operación, Envíos, Configuración) con la pantalla abierta como píldora, el grupo
  abierto, achicado con el menú al costado y renglones de 44 px en el cajón del celular; contador de pendientes en
  Conversaciones y un punto que late en WhatsApp API con una campaña enviando. Lo que se configura una vez (líneas, cuentas
  SMTP) pasó a **Ajustes**. Debajo de `md`, **barra de abajo** (Inicio, Conversaciones, Campañas, Deudores, según
  permisos) con zona segura. **Buscador Ctrl+K**: pantallas, deudores (`/deudores/buscar`) y conversaciones
  (`/wapi/inbox/buscar`), endpoints que ya existían. **Menú de la cuenta** con Mi perfil, Apariencia y Cerrar sesión.
- **Sesión**: guarda de rutas (antes, sin token se veía el marco y recién un 401 mandaba al login), token vencido = sin
  sesión, `?volver=` para regresar a la pantalla después de entrar (también tras un 401), sesión sincronizada entre
  pestañas.
- **Socket único** (`SocketContext`): antes había nueve `io()` y las listas de campañas lo recreaban con cada cambio.
  `useSalaSocket` vuelve a entrar a las salas al reconectar (el backend no tiene "salir"), `useEventoSocket` llama siempre
  al último handler, `useAlReanudar` avisa al reconectar o al volver de segundo plano (más de 20 s) para recargar.
- **Avisos** (`FeedbackContext`): un solo Snackbar para toda la app; reemplaza a cinco mecanismos distintos.
- **Piezas comunes** (`src/components/ui/`): `PageHeader`, `MigasDePan`, `SectionCard`, `DataTableResponsive` (tabla
  desde `md`, tarjetas debajo, nunca `minWidth`), `StatusChip`, `EmptyState`, `BloqueEstado`, `ResponsiveDialog`
  (pantalla completa en el celular, no se cierra tocando afuera, pregunta antes de descartar), `ConfirmDialog` (con
  "escribí X para confirmar"), `KpiTile`, `AvatarUsuario`, `SelectorTema`, `WaBurbuja` + `formatoWhatsApp` (una sola
  burbuja; antes había tres verdes) y `VistaPreviaEmail` (iframe aislado y escalado, en vez de `dangerouslySetInnerHTML`).
  Más `utils/descargar.js`, `components/campanias/estados.js` (los estados de campaña de los tres canales) y
  `permisos.js` (catálogo de permisos; antes estaba escrito dos veces en Roles).
- **Inicio** nuevo, como el "Tu día" de Gestión (antes era una página de presentación sin datos): sin leer, sin asignar,
  tus chats, campañas en curso, las conversaciones que esperan y el aviso para instalar la app. **Mi perfil** (`/perfil`):
  cuenta, lo que podés hacer, tema, notificaciones push y sesión.
- **Carga por pantalla** (`React.lazy` en todas las rutas): el paquete principal pasó de ~2,7 MB a ~715 kB. El
  `<script>` de Unlayer salió de `index.html` (`react-email-editor` lo carga solo).
- `npm run verificar-ui` (`scripts/verificar-ui.mjs`): chequea las reglas que se ven en el código (colores a mano,
  anchos fijos, breakpoint de 768, `console.*`, íconos que no son Lucide, Grid legacy, degradados, emojis).

### PWA y notificaciones push

- **Manifest** completo (`lang es-AR`, descripción, accesos directos a Conversaciones, Campañas y Buscar deudor,
  categorías), íconos nuevos con el logo (normales, enmascarables, `apple-touch-icon`, favicon SVG), meta de iOS,
  `viewport-fit=cover` y zonas seguras, `theme-color` para claro y oscuro, script anti-parpadeo del tema.
- **Service worker propio** (`src/sw.js`, `injectManifest`) con `registerType: 'prompt'`: avisa "Hay una versión nueva"
  (antes `autoUpdate` sin aviso: una app abierta días seguía con el código viejo). No cachea `/api` ni `/socket.io`.
  Busca actualizaciones cada hora y al volver a la pestaña.
- **Push**: módulo `backend/src/modules/push/` (`web-push` 3.6.7), modelo `PushSuscripcion`, endpoints
  `GET /push/clave-publica`, `POST` y `DELETE /push/suscripciones` (solo las propias). Al entrar un mensaje de WhatsApp
  API se avisa al asesor asignado o, sin asignar, a los usuarios activos con `wapi.inbox`; no espera ni rompe el webhook,
  y borra las suscripciones vencidas (404/410). Sin `VAPID_*` arranca deshabilitado. Las notificaciones se activan desde
  Mi perfil; el número de pendientes va al ícono de la app (`setAppBadge`). Reemplaza al `new Notification` del inbox,
  que no existe en Chrome de Android y solo andaba con el inbox abierto.

### Pantallas

- **Conversaciones** (`WapiInbox.jsx` pasó de 1831 líneas a ~480, partido en `components/wapi/inbox/`): tres columnas en
  la computadora (lista, chat y ficha del contacto desde `lg`), lista o chat a pantalla completa en el celular, sin la
  barra de abajo con el chat abierto. El chat abierto va en la URL (`?c=`, el atrás de Android vuelve a la lista) junto
  con `?filtro=`. Acciones con texto (Tomar, Resolver, Asignar, Resumir) y el resto en "Más" (marcar no leída ya no
  depende del click derecho, copiar número, copiar #id). En pantallas táctiles Enter baja de línea y se envía con el
  botón. Respuestas rápidas en un panel desde abajo en el celular, insertadas en el cursor. Un mensaje que no se envió
  queda como burbuja fallida con Reintentar, Editar y Descartar (antes los errores iban a un panel oculto en el celular).
  Los borradores sobreviven a una recarga. Arreglados: el filtro de línea congelado en el socket, el resaltado de "Sin
  asignar" que nunca se activaba, una resuelta con ventana cerrada que decía "ventana cerrada", el doble toque en Tomar,
  la letra de 9–11 px y el buscador que hacía zoom en iOS. Las imágenes se abren dentro de la app.

- **Campañas de WhatsApp API, Monitor y log**: pestañas por estado en la URL, una acción principal por fila y el resto
  en "Más", confirmaciones con cantidades (enviar ahora no confirmaba), avance real desde el principio (una pausada
  mostraba 0 %), "Ver en vivo" lleva a esa campaña, asistente que no se pierde con un toque afuera, delays en segundos,
  validación de la columna `numero` del CSV. El log es pantalla completa en el celular y confirma antes de pausar.
- **Campañas de Email y de WhatsApp Web, Sesiones y Conectar**: una sola pantalla de lista parametrizada por canal
  (`components/campanias/waweb/`), contactos virtualizados con búsqueda, resumen y confirmación antes de enviar, sesiones
  por ANI. Conectar explica los pasos y avisa que no se puede escanear desde el mismo teléfono, el QR vence y se
  regenera, y ya no se pisa entre dos personas conectando a la vez.
- **Plantillas (los tres canales), Envío manual, Desuscripciones, Respuestas rápidas y páginas públicas**: vista previa
  con la burbuja real y con `VistaPreviaEmail`; Unlayer solo desde `md` (en el celular se edita nombre, remitente y
  asunto); "Limpiar todas" las desuscripciones pide escribir «limpiar» y dice cuántas personas vuelven a recibir mails;
  las páginas públicas van siempre en claro y sin el nombre interno.
- **Analítica y reportes**: pestañas y elementos abiertos en la URL, gráficos con los colores del tema, tablas que pasan
  a tarjetas, IA en violeta sin brillos, Reportes y Métricas de WhatsApp Web comparten la campaña elegida.
- **Deudores**: la búsqueda vive en la URL (al volver de la ficha sigue ahí), la ficha muestra el nombre de la empresa y
  tiene llamar, escribir y copiar, el historial carga de a páginas y las fechas son del día local.
- **Ajustes, Administración y Login**: Login de la familia de Gestión, con el mensaje real del backend y `?volver=`
  seguro; Líneas, Cuentas, Tareas, Bajas, Usuarios y Roles con las piezas comunes, confirmaciones y errores visibles.

### Errores arreglados de paso

- WhatsApp Web: el estado vacío de Campañas nunca aparecía (condición invertida); un error al subir una campaña no se
  mostraba (`setMensaje` inexistente); `/enviar` quedaba en blanco y `/subir-campania` fallaba (ahora redirigen a
  `/campanias`); el modal de plantillas se cerraba como si hubiera guardado aunque fallara.
- Email: guardar dos veces una plantilla nueva la duplicaba; el diálogo de borrar una cuenta decía "¿Eliminar template?";
  la doble paginación del detalle de reportes dejaba vacías las páginas siguientes.
- El Grid de MUI 7 (que ignora `item`/`xs`/`md` en silencio) estaba roto en 11 archivos.
- Deudores: el "hasta" del historial cortaba un día (medianoche UTC); la ficha mostraba el ID de la empresa.
- Tareas programadas no guardaba la descripción (ahora va en `configuracion.descripcion`, sin cambio de backend).
- Monitor: una campaña pausada mostraba 0 %; los errores de pausar y reanudar se tragaban.

### Backend

- Módulo `push` y modelo `PushSuscripcion` (relación con `Usuario`, `onDelete: Cascade`). **Lleva `prisma db push`**
  (aditivo: solo crea la tabla).
- `listarCampanias` de WhatsApp API devuelve `configId`: la lista muestra y filtra por línea sin pedir el detalle de
  cada campaña.
- `backend/.env.example` (nuevo, con las variables `VAPID_*`).

### Productividad de los agentes: cuenta cierres, y queda fija

Pedido de las usuarias: "en Sender la productividad da la mitad que en S1, y el número no queda fijo: va variando según
el día en que saco el reporte".

- **Causa**: las "resueltas" de un agente eran las conversaciones que **hoy** tiene asignadas, con el **último
  mensaje** en el rango y que **hoy** están resueltas. Si el cliente contestaba después del cierre ("gracias"), la
  conversación se reabría y su último mensaje se corría: el cierre desaparecía del día en que se hizo. Una conversación
  cerrada dos veces contaba una, y si se reasignaba el cierre pasaba a otro agente.
- **Medido en prod** (01/10 al 22/10): Ana Paula Godoy 362 contra 771 cierres reales, Joaquín Barros 375 contra 710,
  Laura Siri 252 contra 486, Tati De Antoni 166 contra 536. La mitad o menos, como decían.
- **Ahora** (`wapi-analitica.service.ts`, `resumirCierres`): se cuentan los cierres de `WaApiCierreConversacion`
  (una fila por cada vez que alguien resuelve, con quién y cuándo, que no cambia después), en el día de Argentina en
  que se hicieron. Lo que cerró un agente que ya no está activo sigue contando. Mismo cambio en el detalle del agente,
  la evolución diaria (que además usaba días UTC), el Excel de agentes (columnas "Cerradas" y "Conversaciones distintas
  cerradas") y el análisis con IA del equipo.
- En pantalla, "Resueltas" pasa a **"Cerradas"** con cuántas conversaciones distintas fueron; el ranking se ordena por
  cierres y ya no muestra un % sobre las asignadas (con cierres puede pasar del 100 %).
- Los cierres se registran desde el 22/04/2026: un rango anterior da 0.
- Tests: `wapi-analitica.service.spec.ts` (4).

### Después de la auditoría (agente auditor: no pasaba; todo lo de abajo corregido)

- **Redirección abierta en el Login**: `?volver=/%09/otro-sitio` pasaba el filtro (el navegador descarta el tab y queda
  `//otro-sitio`). Ahora se valida la URL ya normalizada (`new URL`) y se exige el mismo origen.
- **Conectar podía borrar una línea que sí se conectó** si el evento del socket se perdía (corte de red al escanear, o
  `ready` que tarda más de 90 s): antes de borrar consulta `GET /whatsapp/sesiones/status/:id` y solo borra en `qr`,
  `inicializando`, `fallo_autenticacion` o `desconectado`; ante la duda no toca nada.
- **El v2 no les iba a llegar a quienes ya usan Sender**: el deploy subía `sw.js` y el manifest con cache de un año y solo
  invalidaba `index.html`. El workflow ahora sube lo que no lleva hash con `no-cache` y lo invalida, y deja de borrar
  los assets viejos (una pestaña atrasada puede seguir pidiendo sus pantallas). El service worker nuevo se activa solo
  si el anterior no era de v2 (marca en caché): las páginas del Sender anterior no tienen el aviso de versión nueva y
  esperaban a que se cerrara todo.
- **Pantalla en blanco al cambiar de versión**: `ErrorBoundary` sobre la app ("Hay una versión nueva, recargá") y
  recarga única ante `vite:preloadError`.
- **Push con la sesión vencida**: un 401 o un token vencido dan de baja la suscripción en el navegador (sin token no hay
  DELETE; el backend borra la fila con el próximo 410). En un puesto compartido seguían llegando los mensajes de quien
  se había ido.
- **Fechas de la analítica de WhatsApp API y del Excel de agentes**: con el servidor en UTC, el rango empezaba a las 21
  del día anterior y cortaba las últimas 3 horas. `parseFechas` usa `-03:00` y el Excel manda las fechas con offset.
- **Eventos de campaña con ids repetidos entre canales**: son globales y llegan con el id solo. La lista de WhatsApp API
  ya no aplica el estado del evento (recarga), y la de Email y WhatsApp Web solo toma `campania_error` de su canal
  (`tipo`); antes el error de una campaña de email marcaba como bloqueada a la de WhatsApp Web con el mismo id.
- **Teclado del celular en Conversaciones**: `interactive-widget=resizes-content` en el viewport (Chrome Android) y alto
  tomado de `visualViewport` (iOS), para que el encabezado del chat no se vaya de la pantalla.
- `/sesiones` vuelve a pedir `whatsapp.sesiones` (el backend lo exige en todo el controller). Una conversación asignada
  a un asesor desactivado ahora avisa a los usuarios del inbox en vez de a nadie. Las páginas públicas no heredan el
  oscuro ni en el primer pintado.

### Pendiente o con riesgo

- **No se probó en un celular real ni instalada como app**: hay un guion de prueba. En iOS el push solo funciona con la
  app instalada desde iOS 16.4, y el popup de Google en la app instalada puede fallar (la salida es `ux_mode: redirect`,
  con cambio de backend).
- Reportes de deudores: el filtro Canal no se aplica a la tabla y los KPI son "de esta página" (el backend no acepta
  `canal` ni devuelve totales).
- `frontend/.env` apunta ahora al backend en el puerto 3001 (estaba en 5001 y el login local no llegaba al backend).

### Deploy

1. Generar las claves VAPID de producción (`npx web-push generate-vapid-keys`) y cargarlas en el `.env` del backend.
2. `prisma db push` en producción (solo crea `PushSuscripcion`).
3. Desplegar el backend con `/opt/amsa/deploy.sh`, **después de verificar que no haya campañas enviando** (recrea los
   workers).
4. Desplegar el frontend (push a `main`; el workflow ya sube `sw.js` y el manifest sin cache y los invalida). El
   service worker nuevo reemplaza al viejo sin aviso esa primera vez y las páginas abiertas recargan solas; desde ahí,
   cada versión nueva se anuncia. Verificar con `curl -I https://amsasender.anamayasa.com/sw.js` que diga `no-cache`.

---

## [2026-08-21] — Envío manual: el asunto, los desuscriptos y el match con el timeline

### Contexto

Salieron de auditar la documentación de usuario de AMSA Gestión contra el código de los dos repos. Los
tres afectan al **envío manual** —el que dispara un gestor desde la ficha de un deudor—, que quedó con
menos garantías que el de campañas.

### `manual-email.service.ts`

- **El asunto del dto ahora gana sobre el del template.** Con `templateId` presente se hacía
  `subject = renderTemplate(template.asunto, vars)` y **nunca se leía `dto.subject`**. Como Gestión
  siempre manda `templateId`, el campo "Asunto" de su pantalla era decorativo: el gestor lo editaba,
  veía su texto en la previsualización y al destinatario le llegaba el de la plantilla. Se sigue
  renderizando, así que las variables resuelven igual; sin `subject`, el comportamiento no cambia.

- **Se omiten los destinatarios desuscriptos.** `email-worker.service.ts` los consulta por hash desde
  `EmailDesuscripciones` y los salta; el envío manual no los miraba, así que quien había apretado
  "Desuscribite" seguía recibiendo los de la ficha. Ahora se precarga el set antes del loop y los
  omitidos quedan con un `ReporteEmail` en estado **`Desuscripto`** —el mismo que usan las campañas—
  para que aparezcan en el timeline del deudor.

  La respuesta suma un campo **`omitidos: { email, motivo }[]`**. No cuentan como error: `ok` sigue
  dependiendo solo de `errores`, y los demás destinatarios salen normalmente.

### `internal-api/features/email/internal-email.controller.ts`

- **`orderBy: { id: 'desc' }` al resolver el documento**, igual que
  `internal-timeline.controller.ts`. `Deudor.documento` **no es único** —hay una fila por cartera— y
  sin orden esta consulta caía en el id más bajo mientras el timeline leía el más alto: con documentos
  repetidos, el mail se colgaba de un registro y se leía de otro, así que no aparecía nunca en la
  ficha.

### Verificación

`nest build` OK. **No se pudo probar de punta a punta**: la base local de Sender tiene `Deudor`,
`ReporteEmail` y `EmailEvento` en cero, así que este flujo nunca se ejercitó acá.

---

## [2026-05-12] — Internal-api: timeline por documento + link de envíos manuales a Deudor

### Contexto

AMSA Gestión necesita ver un timeline unificado (emails + WhatsApp + WAPI) por deudor. Como los sistemas conviven sin id común, el match es por `documento`. Además se detectó que los emails que Gestión enviaba vía `internal/email/manual/send` quedaban con `ContactoEmail.deudorId = NULL`, por lo que nunca aparecían en el timeline aunque existiera el Deudor en Sender.

### Internal-api — nueva sub-feature `timeline`

- **`modules/internal-api/features/timeline/`** — DTO + controller + module.
- **Endpoint:** `GET /api/internal/timeline/por-documento/:documento` con guard `InternalApiKeyGuard` y scope `timeline:read`.
- Resuelve `Deudor` por `documento` (trim) y delega en `DeudoresService.obtenerTimeline()` (UNION ALL ya existente sobre `Reporte`, `ReporteEmail`, `EmailEvento`, `WaApiReporte`).
- Si no hay match → `{ deudor: null, data: [], total: 0 }` (200 OK).
- Registrado en `internal-api.module.ts`. La API key `gestion-dev` se actualizó en `.env` con scopes `["email:*", "timeline:read"]`.

### Internal-api — fix link de envíos manuales

- **`internal-api/features/email/internal-email.controller.ts`** — el endpoint `POST /internal/email/manual/send` ahora acepta opcional `deudorDocumento` en el body. Si llega, resuelve `Deudor` por documento y pasa `deudorId` al service.
- **`email/manual-email/manual-email.service.ts`** — `enviarManual()` y `enviarADestinatario()` aceptan `deudorId` opcional y lo persisten en `ContactoEmail.deudorId` al crear el contacto del envío manual. Sin esto, los envíos quedaban huérfanos y no aparecían en el timeline ni en la ficha del deudor.

### Backfill — `scripts/backfill-contactoemail-deudorid.sql`

- Linkea retroactivamente `ContactoEmail.deudorId` para envíos manuales generados desde Gestión antes del fix.
- Match cross-DB: `whatsapp_automation.ReporteEmail.id ∈ amsa-gestion.envio_email.senderReporteIds (JSON)` → toma `documento` del deudor de Gestión → resuelve `whatsapp_automation.Deudor` por documento.
- Ejecutado en dev: 2 filas actualizadas.

### Seed — `scripts/seed-timeline-mock.sql`

- Seed idempotente que crea un `Deudor` mock (documento `25501071`) con campañas + reportes + eventos en los 3 canales (WhatsApp legacy, Email con OPEN/CLICK, WAPI con read receipt) para validar el timeline. Limpia por marker `MOCK_TIMELINE_*` antes de insertar.

### Notas

- Spec completa del feature en `amsa-gestion/docs/timeline-spec.md`.
- Conversaciones WAPI entrantes y llamadas Neotel quedan fuera de scope (siguiente fase).
- Tablas con `ñ` (`Campaña`, `CampañaEmail`, `WaApiCampaña`) requieren `--default-character-set=utf8mb4` desde mysql client.

---

## [2026-04-22] — WapiInbox: notas de cierre, historial multicierres y navegación desde panel

### Contexto

Feature solicitado para registrar observaciones al resolver una conversación. La arquitectura soporta múltiples cierres sobre el mismo número/línea ya que `WaApiConversacion` se reutiliza (se reactiva cada vez que el contacto vuelve a escribir). Cada cierre queda ligado a la conversación, al usuario que cerró y a la nota opcional. El historial de todos los cierres es visible siempre, incluso cuando la conversación está activa.

### Schema — `prisma/schema.prisma`

- **Nuevo modelo `WaApiCierreConversacion`**: `id`, `conversacionId` (FK a `WaApiConversacion`), `usuarioId Int?` (FK a `Usuario`, nullable para cierres sin asesor), `nota String? @db.Text`, `creadoAt DateTime @default(now())`. Índice `@@index([conversacionId])`.
- **`WaApiConversacion`**: agregada relación inversa `cierres WaApiCierreConversacion[]`.
- **`Usuario`**: agregada relación inversa `cierresWapi WaApiCierreConversacion[]`.
- Schema sincronizado con `prisma db push --accept-data-loss` (no usa migraciones).

### Backend — `src/modules/wapi/inbox/`

#### `wapi-inbox.service.ts`

- **`resolverConversacion(id, usuarioId?, nota?)`**: refactorizado a `$transaction` atómico — actualiza `WaApiConversacion` (estado→`resuelta`, `resolvedAt`) y crea el registro `WaApiCierreConversacion` en la misma transacción. La nota se limpia con `.trim()` y se guarda como `null` si está vacía.
- **`obtenerConversacion(id)`**: ahora incluye `cierres` con `orderBy: { creadoAt: 'asc' }` y join al `usuario` (id + nombre) para mostrar quién cerró.

#### `wapi-inbox.controller.ts`

- **`POST :id/resolver`**: acepta `body: { nota?: string }` y propaga el `usuarioId` desde el JWT al servicio.

### Frontend — `frontend/src/components/wapi/WapiInbox.jsx`

- **Dialog de cierre**: al presionar "Resolver" se abre un `Dialog` con textarea para ingresar nota opcional. Dos acciones: "Cerrar sin nota" y "Cerrar con nota". Estados `dialogCierre`, `notaCierre`, `resolviendoConv`.
- **Panel colapsable de cierres en el header**: badge ámbar "N notas" visible solo cuando hay cierres registrados. Al hacer clic despliega un `Collapse` con la lista de cierres (más reciente primero), con ícono de candado, nombre del asesor, fecha relativa y texto de la nota (truncado a 2 líneas). El click en una nota hace scroll suave al marcador correspondiente en el chat + efecto flash ámbar de 1.5 s.
- **Marcadores de cierre en el timeline**: píldoras ámbar insertadas cronológicamente entre los mensajes. Muestran "Cerrado por [nombre] · [nota truncada]". Renderizados con `cierreRefs` para soportar el scroll desde el panel.
- **Cierres post-último mensaje**: los cierres que ocurrieron después del último mensaje se agregan al final del timeline.
- **Preservación de cierres al tomar/asignar conversación**: los `setConvActiva` en `tomarConv` y `asignarConversacion` ahora usan `prev => ({ ...data, cierres: prev?.cierres ?? [] })` para no perder los cierres cargados por `obtenerConversacion`.

---

## [2026-04-22] — WapiInbox: divisores de fecha y indicador de fecha en header

### Frontend — `frontend/src/components/wapi/WapiInbox.jsx`

- **Divisores de fecha entre grupos de mensajes**: se inserta una línea sutil con la fecha centrada cada vez que cambia el día en el historial de conversación. Formato inteligente: "Hoy" / "Ayer" / nombre del día + fecha para la semana actual / fecha completa para más antiguo.
- **Indicador de fecha en el header del chat**: badge compacto con ícono de calendario que muestra la fecha del último mensaje de la conversación. Solo visible en desktop. Aparece condicionalmente cuando hay mensajes cargados.
- **Nuevas funciones de formateo**: `formatDividerDate(ts)` y `formatHeaderDate(ts)` con soporte completo de localización `es-AR`.

---

## [2026-04-17] — Módulo Deudores: ficha 360°, timeline omnicanal y reportes (Fase 0 integración AMSA Gestión)

### Contexto

Primera fase de la integración con AMSA Gestión (Opción B: Gestión como SOR). Se normalizó el modelo de contactos creando una entidad maestra `Deudor` que unifica los registros que hoy viven dispersos en los 3 canales (WhatsApp legacy, Email, WAPI Meta). Cada `Contacto` / `ContactoEmail` / `WaApiContacto` queda enlazado opcionalmente a un `Deudor` por FK, y los nuevos imports populan la entidad master automáticamente. Sobre esa base se construyó la **ficha 360° de deudor** con timeline omnicanal y los **reportes agregados por empresa y remesa** con exportación CSV/XLSX.

### Schema — `prisma/schema.prisma`

- **Modelo `Deudor`**: `id`, `idDeudor Int? @unique` (id externo del sistema fuente), `nombre`, `documento`, `nroEmpresa`, `empresa`, `remesa`, `datos Json?` (campos extra del CSV), `creadoEn`, `actualizadoEn`. Relaciones inversas a `Contacto[]`, `ContactoEmail[]`, `WaApiContacto[]`. Índices `@@index([empresa, nroEmpresa])` y `@@index([nroEmpresa])`.
- **`Contacto`**: agregado `deudorId Int?` + relación a `Deudor`. Índices `@@index([deudorId])` y `@@index([deudorId, campañaId])`.
- **`ContactoEmail`**: agregado `deudorId Int?` + relación. Índice `@@index([deudorId])`.
- **`WaApiContacto`**: agregado `deudorId Int?` + relación. Índice `@@index([deudorId])`.
- **`Reporte`**: nuevos índices `@@index([campañaId, numero])` (para joins textuales del timeline WhatsApp legacy) y `@@index([enviadoAt])`.
- **`ReporteEmail`**: nuevo índice `@@index([enviadoAt])`.
- **`WaApiReporte`**: nuevo índice `@@index([enviadoAt])`.

### Migración manual — `prisma/sql/fase-0-migracion-deudor-sin-funcion.sql`

Script SQL pensado para correr en MySQL Workbench contra producción sin requerir privilegios `SUPER` (RDS-compatible, sin stored functions). 8 secciones idempotentes:

1. DDL: crea `Deudor` y agrega `deudorId` + FK + índices a las 3 tablas hijas.
2. Crea staging table `_stg_deudor_import`.
3. Pobla la staging desde `Contacto.datos`, `ContactoEmail.datos` y `WaApiContacto.variables` usando `JSON_TABLE` + `JSON_KEYS` con búsqueda case-insensitive de las claves (`deudor`, `iddeudor`, `apenom`, `nombre`, `cuitdoc`, `documento`, `empresa`, `nroemp`, `remesa`).
4. Inspección de la staging.
5. INSERT en `Deudor` con `GROUP BY idDeudor` + `ON DUPLICATE KEY UPDATE` con `COALESCE` para no pisar campos previos con NULL.
6. Backfill de `deudorId` en las 3 tablas hijas vía JOIN con la staging.
7. Verificación de cobertura.
8. Cleanup de la staging.

### Backend — `src/modules/deudores/` *(nuevo módulo)*

#### `deudores.service.ts`

- **`upsertDesdeImport(rawRow)`**: idempotente, case-insensitive sobre las claves del CSV, no pisa campos existentes con NULL/vacío, hace deep-merge del campo `datos`, maneja race condition `P2002` con retry. Devuelve el `Deudor` o `null` si la fila no trae `idDeudor`.
- **`buscar(filtros)`**: paginación offset (10/20/50/100), búsqueda libre por `nombre`/`documento`/`nroEmpresa` o por `idDeudor` cuando el query es numérico, filtros por `empresa`/`nroEmpresa`/`remesa`. Devuelve `_count` por canal (chips de la lista).
- **`obtenerEmpresas()`** y **`obtenerRemesas(empresa?)`**: distinct ordenado para alimentar los selects en cascada.
- **`obtenerPorId(id)`**: devuelve la ficha master + arrays únicos de teléfonos (mergea WhatsApp legacy + WAPI) y emails (normalizados a lowercase).
- **`obtenerTimeline(id, query)`**: UNION ALL de 4 subqueries con `Prisma.sql` parametrizado (cero string concat):
  - WhatsApp legacy (`Reporte` ↔ `Contacto` por cruce textual `(campañaId, numero)`)
  - Email envíos (`ReporteEmail` ↔ `ContactoEmail`)
  - Email eventos (`EmailEvento` con `OPEN`/`CLICK`)
  - WAPI Meta (`WaApiReporte` ↔ `WaApiContacto`, joineando `WaApiTemplate` para nombre del template)

  Filtros dinámicos por canal (incluye/excluye subqueries) y por rango `desde`/`hasta`. Paginación + `COUNT` en paralelo.
- **`obtenerReporteEmpresas(query)`** y **`obtenerReporteRemesas(query)`**: ejecutan 5 queries SQL agregadas en paralelo (deudores+contactos por canal, envíos WA, envíos+métricas Email, rebotes Email, envíos+estados WAPI), mergean por empresa (o empresa+remesa) en un `Map`, calculan tasas con `safeDivide` (denominador 0 → 0) redondeadas a 4 decimales. Internamente delegan en métodos privados `calcularReporteEmpresas`/`calcularReporteRemesas` que devuelven el array completo sin paginar (reutilizables por el export).
- **`exportarReporte(query)`**: orquesta generación de buffer según `tipo` (`empresa`|`remesa`) y `formato` (`csv`|`xlsx`). Devuelve `{ buffer, filename, contentType }` con timestamp en el nombre.
- **`exportarDetalle(query)`**: genera exportación global desglosada (fila por actividad), integrando interacciones de WhatsApp Legacy, Email y WAPI Meta. Devuelve CSV o XLSX con 16 columnas estandarizadas de deudores y datos de campaña.
- **CSV**: separador `;` (estándar Excel ES), BOM UTF-8 para tildes/ñ, escapado de comillas y saltos. Tasas como string `XX.XX%`.
- **XLSX (ExcelJS)**: header en negrita con fondo gris, columnas con anchos calibrados, tasas como decimal con `numFmt: '0.00%'` para que Excel las renderice y permita cálculos.

#### `deudores.controller.ts`

Endpoints bajo `/api/deudores`, protegidos con `JwtAuthGuard` + `PermisosGuard`. Rutas fijas declaradas **antes** de `:id` para evitar colisión con el param dinámico:

- `GET /buscar` — `deudores.ver`
- `GET /empresas` — `deudores.ver`
- `GET /remesas?empresa=` — `deudores.ver`
- `GET /reportes/empresas` — `deudores.reportes`
- `GET /reportes/remesas` — `deudores.reportes`
- `GET /reportes/exportar` — `deudores.reportes` (devuelve archivo con `Content-Disposition: attachment`)
- `GET /reportes/exportar-detalle` — `deudores.reportes` (descarga archivo detallado de cada actividad con múltiples filtros opcionales)
- `GET /:id` — `deudores.ver`
- `GET /:id/timeline` — `deudores.ver`

#### DTOs

- `BuscarDeudoresDto` (q, empresa, nroEmpresa, remesa, page, size).
- `TimelineQueryDto` (page, size, canal `whatsapp|email|wapi`, desde, hasta ISO 8601).
- `ReporteQueryDto` (empresa, desde, hasta, page, size).
- `ExportarReporteDto` (tipo, formato, empresa, desde, hasta).

#### Integración con imports CSV existentes

- **`whatsapp/campanias/campanias.service.ts`**: loop serial llamando `upsertDesdeImport` por contacto.
- **`email/campanias-email/campanias-email.service.ts`**: upsert en chunks de 1000 con `Map<idCsv, deudorId>`, luego `createMany` en chunks de 10k.
- **`wapi/campanias/wapi-campanias.service.ts`**: mismo patrón, `createMany` en chunks de 5k.
- Parsers (`utils/csv-parser*.ts`) ahora devuelven `rawRow: Record<string, any>` para alimentar el upsert.

### Backend — `src/modules/auth/`

- Nuevos permisos disponibles para asignación: `deudores.ver` y `deudores.reportes`.

### Frontend — `src/components/deudores/` *(nuevo)*

#### `ListadoDeudores.jsx`

Buscador con debounce de 400ms, filtros en cascada (empresa → remesa cargados desde la API), tabla MUI con chips por canal (WhatsApp/Email/WAPI), `TablePagination` (10/20/50/100), skeleton loading, empty state, dark mode estricto. Click en fila navega a `/deudores/:id`.

#### `FichaDeudor.jsx`

Vista 360° del deudor:
- Header con botón Volver + nombre + chip de `idDeudor`.
- Card "Datos del deudor" (documento, empresa, nroEmpresa, remesa, fechas).
- Card "Canales de contacto" con chips de teléfonos y emails únicos.
- Card "Datos adicionales" con render del JSON `datos`.
- Sección de timeline omnicanal embebida (`<TimelineDeudor />`).
- Estados de loading (skeleton), 404 y error genérico.

#### `TimelineEntry.jsx`

Card horizontal por interacción:
- Avatar circular con icono y color según canal:
  - **WhatsApp Web** (legacy): `PhonelinkIcon` púrpura `#7B1FA2` — mismo del sidebar.
  - **WhatsApp Meta** (WAPI): `WhatsAppIcon` verde `#25D366`.
  - **Email envío**: `EmailIcon` info, **open**: `MarkEmailReadIcon`, **click**: `AdsClickIcon` naranja.
- Header: `{Canal} · {Tipo}` + chip de estado coloreado.
- Detalle condicional: asunto, mensaje (truncado a 80), templateNombre, urlDestino (link), error (rojo), nombre de campaña.
- Borde izquierdo del color del canal, soporte dark/light.

#### `TimelineDeudor.jsx`

Container del timeline:
- Filtros: `Select` canal (Todos / WhatsApp Web / WhatsApp Meta / Email), `TextField` desde/hasta, botón Limpiar.
- Lista vertical de `TimelineEntry`, paginación (10/30/50/100).
- Estados loading (skeletons), error (Alert), empty.

#### `ReportesDeudores.jsx`

Dashboard de reportes con 2 tabs (Por empresa / Por remesa):
- Filtros compartidos: empresa (solo en tab remesa), desde, hasta.
- 4 KPI cards arriba: Total Deudores, Total Envíos, Tasa Apertura Email (ponderada por entregados), Tasa Lectura WAPI (ponderada).
- Tabla con: deudores, contactos por canal (chips), envíos por canal, métricas Email (entregados/abiertos/clicks/rebotes/% apertura/% click), métricas WAPI (entregados/leídos/fallidos/% entrega/% lectura).
- Botón **Exportar** con `<Menu>` (CSV / XLSX): fetch con `responseType: 'blob'`, extracción de filename desde `Content-Disposition`, descarga vía `<a download>` y limpieza del blob URL. `CircularProgress` durante la descarga.
- Menú **Exportar Actividades (Fila x Actv.)**: Despliega subopciones para descargar un reporte de eventos uno a uno de contactos y deudores, con un filtro por canal (WhatsApp/Email) insertado a la medida de este exporte, además de la remesa.

### Frontend — integración

- **`App.jsx`**: rutas `/deudores`, `/deudores/reportes` (declarada antes de `/deudores/:id`) y `/deudores/:id`, todas con `RutaProtegida`.
- **`NavBar.jsx`**: nueva sección colapsable "Deudores" con items "Buscar deudores" (`PeopleIcon`, permiso `deudores.ver`) y "Reportes" (`BarChartIcon`, permiso `deudores.reportes`).
- **`GestionRoles.jsx`**: agregada sección "Deudores" en el editor de roles con los 2 permisos.

---

## [2026-04-15] — WapiInbox: soporte multi-línea (multi-WABA)

### Contexto

Se dio de alta una segunda línea WhatsApp (segundo WABA) en la cuenta Business. Se implementó soporte para múltiples líneas en el inbox, de forma dinámica y extensible para futuros WABAs adicionales.

### Backend

- **Schema Prisma**: agregado campo `configId` en `WaApiConversacion` con relación a `WaApiConfig`. Constraint único cambiado de `numero` a `(numero, configId)` — el mismo contacto puede tener conversaciones separadas por línea.
- **WapiConfigService**: nuevo método `obtenerConfigPorPhoneNumberId()` para identificar la línea a partir del `phone_number_id` de Meta.
- **WapiWebhookService**: extrae `metadata.phone_number_id` de cada evento de Meta para identificar la línea receptora. Si el `phone_number_id` no corresponde a ninguna config registrada, el evento se descarta silenciosamente sin romper el 200 OK a Meta.
- **MensajeEntranteDto**: nuevo DTO en `inbox/dtos/mensaje-entrante.dto.ts` con campo `configId` obligatorio.
- **WapiInboxService**: lookup y creación de conversaciones por `{ numero, configId }`. Queries incluyen nombre de la config en la respuesta. Usa `upsert` para evitar race conditions.
- **WapiInboxController**: endpoints de listado aceptan query param `?configId=` opcional para filtrar por línea.
- **Sockets**: todos los eventos del inbox (`wapi:nuevo_mensaje`, `wapi:mensaje_status`, `wapi:conversacion_actualizada`, `wapi:typing`) incluyen `configId` en el payload.

### Frontend

- **Selector de línea**: `ToggleButtonGroup` sobre el listado con opciones "Todas" + una por cada config activa. Cargado dinámicamente desde la API.
- **Filtrado local**: conversaciones filtradas por línea seleccionada sin llamadas adicionales al servidor.
- **Persistencia**: línea seleccionada guardada en `localStorage`.
- **Badge de línea**: chip en el header de la conversación activa indicando a qué línea pertenece (visible solo con más de 1 config).
- **Indicador en lista**: nombre de la línea como texto secundario en cada item del listado, visible solo en la vista "Todas".

### Migración de datos

Las conversaciones existentes deben asignarse a `configId = 1` ejecutando en MySQL Workbench:
```sql
UPDATE WaApiConversacion SET configId = 1 WHERE configId IS NULL OR configId = 0;
```

---

## [2026-04-10] — Migración IA: Gemini → Amazon Bedrock (Llama 3.3)

### Contexto

Gemini API presentó problemas de quota `limit: 0` en todos los modelos disponibles tanto con cuentas de Google Workspace como personales, independientemente del proyecto de Google Cloud. Se migró a Amazon Bedrock aprovechando la infraestructura AWS ya existente.

### Backend — `src/modules/ai/bedrock.service.ts` (nuevo)

- **Reemplaza `GeminiService`** — misma interfaz pública, mismos 4 métodos.
- Usa `@aws-sdk/client-bedrock-runtime` con `InvokeModelCommand`.
- Modelo: **Llama 3.3 70B Instruct** (`us.meta.llama3-3-70b-instruct-v1:0`) vía inferencia entre regiones en `us-east-1`.
- Formato de prompt Llama 3: tokens especiales `<|begin_of_text|>`, `<|start_header_id|>system<|end_header_id|>`, etc.
- `max_gen_len: 4096` para respuestas completas y detalladas.
- Temperatura `0.7` para inbox (respuestas naturales) y `0` para analítica (determinístico).
- Prompts de analítica actualizados para instruir respuestas detalladas basadas en datos concretos.
- Credenciales y región configurables vía `.env`.

### Backend — `src/modules/ai/ai.module.ts`

- Reemplazado `GeminiService` por `BedrockService` en providers y exports.

### Backend — servicios consumidores

- `wapi-inbox.service.ts`: import actualizado a `BedrockService`.
- `wapi-analitica.service.ts`: import actualizado a `BedrockService`.

### Backend — `.env`

- Nuevas variables: `AWS_BEDROCK_ACCESS_KEY_ID`, `AWS_BEDROCK_SECRET_ACCESS_KEY`, `AWS_BEDROCK_REGION`, `AWS_BEDROCK_MODEL_ID`.
- Variables de Gemini conservadas por compatibilidad pero sin uso activo.

### Frontend — `src/components/PaginaInicio.jsx`

- Referencia a "Gemini" en el banner IA reemplazada por "IA" genérico.

---

## [2026-04-10] — IA Generativa + Rediseño visual UI

### Backend — `src/modules/ai/gemini.service.ts` (nuevo)

- **Servicio Gemini**: integración con Google Gemini AI (`gemini-flash-latest`) via `@google/generative-ai`.
- Dos instancias del modelo: temperatura default para respuestas conversacionales (inbox) y `temperature: 0` para analítica (resultados determinísticos).
- `generarResumen(mensajes)`: resumen de conversación en hasta 5 viñetas en español argentino.
- `generarSugerencia(mensajes, contexto)`: sugerencia de respuesta para el agente usando respuestas rápidas como base de conocimiento, con filtrado por campaña activa.
- `generarAnalisisCampania(metrics, historial)`: informe completo de campaña con secciones 📊💡⚠️🎯. Incluye comparación histórica contra campañas anteriores del mismo template.
- `generarAnalisisAgentes(metrics)`: informe de desempeño del equipo con secciones 👥🏆🔴📈🎯.
- `buildBaseConocimiento()`: construye contexto separando respuestas rápidas de la campaña activa vs generales.

### Backend — `src/modules/ai/ai.module.ts` (nuevo)

- Módulo NestJS que provee y exporta `GeminiService`, importable desde otros módulos.

### Backend — `src/modules/wapi/inbox/wapi-inbox.service.ts`

- Inyección de `GeminiService`.
- `generarResumen(id)`: endpoint que resume la conversación con IA.
- `generarSugerencia(id)`: endpoint que sugiere respuesta contextual al agente.
- `obtenerRespuestasRapidasParaIA()`: carga respuestas rápidas activas con tags parseados para usarlas como base de conocimiento.
- Al crear ficha de contacto: actualiza `campañaNombre` en la conversación antes de emitir socket `wapi:conversacion_actualizada`, garantizando que el campo llegue al frontend.

### Backend — `src/modules/wapi/inbox/wapi-inbox.controller.ts`

- `POST :id/ai/resumen`: genera resumen de conversación con IA.
- `POST :id/ai/sugerencia`: genera sugerencia de respuesta con IA.

### Backend — `src/modules/wapi/analitica/wapi-analitica.service.ts`

- `analizarCampaniaConIA(id)`: obtiene métricas + historial del mismo template en paralelo, llama a Gemini.
- `analizarAgentesConIA(desde, hasta)`: obtiene métricas del período y genera análisis del equipo.
- `historialCampaniasMismoTemplate(id)`: busca las últimas 5 campañas finalizadas con el mismo `templateId` para comparación histórica.

### Backend — `src/modules/wapi/analitica/wapi-analitica.controller.ts`

- `POST campania/:id/ai`: análisis IA de campaña.
- `POST agentes/ai`: análisis IA del equipo de agentes.

### Backend — `prisma/schema.prisma`

- Campo `campañaNombre String?` en `WaApiConversacion`: nombre de campaña denormalizado para el listado del inbox sin joins.

### Frontend — `src/components/wapi/WapiInbox.jsx`

- **Tag de campaña** en la lista de conversaciones: chip con el nombre de la campaña truncado a 14 caracteres.
- **Botón Resumen IA**: abre modal con resumen generado por Gemini. Loading con ícono giratorio + texto shimmer animado. Distingue error 429 (saturación) de error genérico.
- **Botón Sugerencia IA**: llama a la API y pre-carga el texto en el input de respuesta.
- Todos los botones de acción (Tomar, Asignar, Resuelta, Clip, Rayo, Enviar, IA) con degradado azul→violeta y efecto glow en hover adaptado a dark/light mode.
- Input area: `alignItems: flex-start` + offset en botones para alinear correctamente con el textarea.

### Frontend — `src/components/wapi/analitica/PanelAnalisisIA.jsx` (nuevo)

- Componente reutilizable que recibe `endpoint`, `label` y `disabled`.
- Botón con degradado azul→violeta + animación `aiGlow` durante la carga.
- Panel colapsable con borde y fondo azul tintado.
- `renderAnalisis()`: parsea el texto por secciones emoji y renderiza con colores por tipo.
- Estado de error con `Alert` + botón Reintentar. Botón "Regenerar" cuando el análisis ya está cargado.

### Frontend — `src/components/wapi/analitica/MetricasCampania.jsx`

- `PanelAnalisisIA` integrado arriba de las KPI cards.

### Frontend — `src/components/wapi/analitica/MetricasAgentes.jsx`

- `PanelAnalisisIA` integrado arriba de las KPI cards.

### Frontend — `src/components/Login.jsx`

- **Card "Inteligencia Artificial"** como primera feature del panel derecho: fondo sutil, borde violeta, título con degradado azul→violeta.
- Borde del color característico (`${color}55`) aplicado a todos los feature cards.
- Chip "Impulsado por IA" con animación `aiPulse` (borde que pulsa) junto al chip de plataforma.
- Círculo decorativo azul/violeta agregado al fondo.
- Subtítulo actualizado: "potenciado con IA generativa".
- Título "AMSA **Sender**" con degradado verde `#075E54 → #25D366` en "Sender", `fontWeight: 800`, `letterSpacing: -0.5px`.

### Frontend — `src/components/PaginaInicio.jsx`

- **Fondo degradado** estilo Login en tonos verde/negro/gris: dark `#0d1117 → #0d2016`, light `#f0f4f0 → #f5faf5 → #eaf2ea`. Márgenes negativos para cubrir el padding del NavBar.
- Dos círculos decorativos verdes en el fondo.
- **Banner "Ahora impulsado por IA generativa"**: panel destacado con ícono AI degradado, descripción y chip "NUEVO".
- **Card "Inteligencia Artificial"** como primera feature: borde violeta, glow en hover.
- Chip "IA Generativa" con animación `aiPulse` en la fila de chips.
- Borde del color característico aplicado a todos los feature cards.
- Título "AMSA **Sender**": degradado verde, `fontWeight: 800`, `letterSpacing: -0.5px`.

### Frontend — `src/components/NavBar.jsx`

- Título "AMSA **Sender**": "Sender" con degradado `#b0ffc8 → #25D366` (más claro que Login para contrastar con el fondo oscuro del navbar), `fontWeight: 800`, `letterSpacing: -0.5px`.
- Avatar del usuario: ring verde uniforme `0 0 0 2px #25D366` + glow `rgba(37,211,102,0.4)` para foto y para iniciales.

---

## [2026-04-06] — WAPI: delay aleatorio y límite diario por línea

### Worker — `wapi-worker.service.ts`

- **Delay aleatorio entre mensajes**: reemplazado el delay fijo por un rango configurable `delayMinMs`/`delayMaxMs`. El worker calcula un valor aleatorio dentro del rango antes de cada envío, eliminando el patrón uniforme que los sistemas de Meta detectan como automatización.
- **Límite diario de mensajes**: antes de cada envío, el worker cuenta los mensajes enviados hoy para esa línea. Si se alcanza `dailyLimit` (leído de `WaApiConfig`), la campaña se pausa automáticamente con log descriptivo. Al día siguiente se puede reanudar desde donde quedó.
- Compatibilidad con campañas viejas que tengan `delayMs` guardado en BD.

### Schema — `prisma/schema.prisma`

- **`WaApiConfig`**: nuevo campo `dailyLimit Int @default(200)`. Representa el máximo de mensajes por día según el tier de Meta (250 → usar 200; 1000 → usar 900). Al subir de tier solo se actualiza en la config de la línea.

### Backend — DTOs

- **`guardar-wapi-config.dto.ts`**: campo `dailyLimit` opcional.
- **`crear-wapi-campania.dto.ts`**: reemplazado `delayMs` por `delayMinMs` y `delayMaxMs`.
- **`wapi-campanias.service.ts`**: guarda `delayMinMs` (default 30000) y `delayMaxMs` (default 60000) en el config de campaña.

### Frontend — `SubirCampaniaWapiModal.jsx`

- Reemplazado el input único de delay por dos inputs: "Delay mínimo" y "Delay máximo" (rango 5s–120s).
- Validación: botón "Crear campaña" deshabilitado si mínimo >= máximo.
- Resumen muestra el rango en segundos: "30s – 60s (aleatorio)".

### Frontend — `WapiConfig.jsx`

- Nuevo input "Límite diario de mensajes" en el dialog de crear/editar línea, con helper text indicando valores recomendados por tier.

---

## [2026-04-01] — WAPI: responsive plantillas rápidas, sync de templates y permiso dedicado

### Frontend — `WapiRespuestasRapidas.jsx`

- **Responsive completo**: en mobile (< 600 px) la tabla de plantillas se reemplaza por cards apiladas mostrando título, chip de estado, preview de contenido y tags, con botones de acción verticales.
- **Dialogs a pantalla completa en mobile**: tanto el dialog de crear/editar como el de confirmar eliminación usan `fullScreen` en pantallas pequeñas.
- **Toolbar de formato**: el hint de marcado (`*negrita* · _cursiva_...`) se oculta en xs para no desbordar la barra de herramientas.
- Se importa `useMediaQuery` para detectar el breakpoint `sm`.

### Backend — `wapi-templates.service.ts`

- **Sync elimina templates borrados en Meta**: después de hacer upsert de los templates recibidos desde Meta, se ejecuta un `deleteMany` que borra de la BD cualquier `WaApiTemplate` del mismo `wabaId` que ya no exista en la respuesta de la API.
- **Salvaguarda anti-borrado masivo**: la eliminación solo corre si Meta devolvió al menos un template, evitando wipe total ante respuestas vacías inesperadas.
- Gracias al `onDelete: SetNull` en `WaApiCampaña`, las campañas que usaban un template eliminado quedan con `templateId = null` sin errores de FK.
- El método retorna `{ sincronizados, eliminados, errores }` (nuevo campo `eliminados`).

### Permisos — permiso `wapi.respuestas_rapidas` (nuevo)

- **`GestionRoles.jsx`**: agrega `wapi.respuestas_rapidas` ("Plantillas rápidas") como ítem independiente en la sección "Inbox WA" del editor de roles, y lo incluye en el badge de progreso de acceso.
- **`NavBar.jsx`**: el ítem "Plantillas rápidas" en el sidebar Configuración ahora usa `wapi.respuestas_rapidas` en lugar de `wapi.inbox.admin`.
- **`App.jsx`**: la ruta `/config/respuestas-rapidas` protegida con el nuevo permiso.
- **`wapi-respuestas-rapidas.controller.ts`**: los endpoints de gestión (`GET /todas`, `POST`, `PUT /:id`, `DELETE /:id`) cambian de `wapi.inbox.admin` a `wapi.respuestas_rapidas`. El `GET /` (solo activas para agentes) mantiene `wapi.inbox`.
- **`seed.ts`**: `wapi.respuestas_rapidas` añadido a `TODOS_LOS_PERMISOS`.

---

## [2026-03-30] — WAPI: soporte de contactos compartidos y mejoras del simulador

### Inbox — `WapiInbox.jsx`

- **Card visual para mensajes de tipo `contacts`**: muestra avatar con inicial, nombre en negrita, teléfono y empresa. Reemplaza el texto `[contact]` que se mostraba antes.
- **Preview enriquecido en la lista de conversaciones**: en lugar de `[tipo]` ahora muestra `📷 Imagen`, `🎵 Audio`, `📄 Documento`, `📇 Contacto` según el tipo del último mensaje.
- **Documento**: ahora prioriza `filename` sobre `caption` al mostrar el nombre del archivo y en el link de descarga.

### Backend webhook — `wapi-webhook.service.ts`

- **Nuevo case `contacts` en `extraerContenido`**: extrae nombre (`formatted_name`), teléfonos, emails y empresa de cada contacto del array `contacts` que envía Meta. Antes caía al default `{ raw: msg }`.
- **Campo `filename` en documentos**: agregado a la extracción del tipo `document`.

### Simulador dev — `dev-simulador.controller.ts` / `DevSimulador.jsx`

- **Nuevos endpoints**: `POST /dev/simular/audio`, `POST /dev/simular/documento`, `POST /dev/simular/contacto`.
- **UI del simulador**: nueva fila de paneles para Audio (nota de voz ogg/opus), Documento (nombre de archivo + caption) y Contacto (nombre + teléfono + empresa).
- **Nuevo escenario rápido** "Cliente comparte contacto" en las cards de acceso rápido.

---

## [2026-03-30] — WAPI: plantillas rápidas (respuestas rápidas) en el inbox

### Nuevo modelo — `prisma/schema.prisma`

- **Modelo `WaApiRespuestaRapida`**: `id`, `titulo`, `contenido` (Text, soporta markdown WhatsApp), `tags` (Json), `activo` (Bool), `creadoAt`, `updatedAt`. Sincronizado con la BD vía `prisma db push`.

### Backend — `src/modules/wapi/respuestas-rapidas/` *(nuevo módulo)*

- **`wapi-respuestas-rapidas.service.ts`**: CRUD completo — `listar()` (solo activas, para agentes), `listarTodas()` (admin), `crear()`, `actualizar()`, `eliminar()`.
- **`wapi-respuestas-rapidas.controller.ts`**: endpoints bajo `/wapi/respuestas-rapidas`:
  - `GET /` — solo activas, requiere permiso `wapi.inbox`
  - `GET /todas` — todas incluyendo inactivas, requiere `wapi.inbox.admin`
  - `POST /`, `PUT /:id`, `DELETE /:id` — requieren `wapi.inbox.admin`
- **`wapi-respuestas-rapidas.module.ts`**: importa `PrismaModule` y `AuthModule`. Registrado en `WapiModule`.

### Frontend — administración (`WapiRespuestasRapidas.jsx`)

- **Pantalla de administración** accesible desde `/config/respuestas-rapidas` (sidebar Config, solo admin).
- Editor de contenido con toolbar de markdown WhatsApp: **negrita** (`*`), _cursiva_ (`_`), ~~tachado~~ (`~`), `monoespaciado` (` ``` `).
- **Preview en tiempo real** del mensaje con formato WhatsApp renderizado.
- Soporte de **tags** para categorizar plantillas; filtro por tag en la lista.
- Activar/desactivar plantillas sin eliminarlas.

### Frontend — atajo en el inbox (`WapiInbox.jsx`)

- **Panel flotante de respuestas rápidas** (Popper) que se activa escribiendo `/` en el campo de texto o pulsando el botón ⚡.
- Filtra en tiempo real por título, contenido o tag mientras se escribe.
- Navegación con ↑↓ y selección con Enter o clic; al seleccionar inserta el contenido en el campo de texto.
- Solo carga plantillas activas. Se cierra con Escape o al borrar el `/` inicial.

---

## [2026-03-30] — WAPI: marcar como no leído, búsqueda por ID y fix módulo respuestas rápidas

### Inbox — `WapiInbox.jsx`

- **Marcar conversación como no leída**: click derecho sobre cualquier conversación abre un menú contextual (estilo WhatsApp Web) con la opción "Marcar como no leído". Restaura el badge verde con contador 1. La opción se deshabilita si la conversación ya tiene mensajes sin leer.
- **Búsqueda por ID con prefijo `#`**: escribir `#14` en el buscador filtra exactamente la conversación con ID 14, consistente con el chip `#ID` mostrado en el header del chat. La búsqueda normal (número/nombre) no mezcla resultados de ID para evitar falsos positivos.

### Backend — `wapi-inbox.service.ts` / `wapi-inbox.controller.ts`

- **Nuevo método `marcarNoLeido(id)`**: setea `unreadCount: 1` y emite el evento socket `wapi:conversacion_actualizada` para actualizar el badge en tiempo real en todos los clientes conectados.
- **Nuevo endpoint `POST /wapi/inbox/:id/marcar-no-leido`**.

### Fix — `wapi-respuestas-rapidas.module.ts`

- **Fix: error de arranque `UnknownDependenciesException`** en `WapiRespuestasRapidasModule`. El módulo solo importaba `PrismaModule` pero `JwtAuthGuard` requiere `JwtService` provisto por `AuthModule`. Agregado `AuthModule` a los imports del módulo.

---

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
