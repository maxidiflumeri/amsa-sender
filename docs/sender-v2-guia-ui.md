# Sender v2 — guía de interfaz

Sender v2 es de la misma familia que AMSA Gestión: el mismo marco, la misma letra (Inter), los mismos íconos
(Lucide), las mismas tarjetas y los mismos patrones. **Lo único propio es el acento verde** (`#075E54` en claro,
`#25D366` en oscuro) y el logo. Todo tiene que andar en un celular de 360 px y como app instalada (PWA).

Propuesta y maquetas: https://claude.ai/artifact/GPeQrtau7EUiRVKAzPRvtU

## El marco (ya hecho, no se toca desde las pantallas)

- `components/layout/AppShell.jsx`: barra de arriba + menú lateral sobre `background.marco`, la pantalla en un panel
  redondeado desde `md`. Debajo de `md`, barra de abajo (Inicio, Conversaciones, Campañas, Deudores).
- El panel ya pone el padding (`px` 2/3/4) y el espacio para la barra de abajo. **Una pantalla no agrega márgenes
  propios alrededor ni márgenes negativos**, ni usa `calc(100vh - 64px)`.
- Una pantalla que maneja su propio alto y scroll (Conversaciones) llama `usePantallaCompleta()` de
  `components/layout/ShellContext`; con un chat abierto en el celular, `useOcultarBarraInferior(true)`.

## Piezas comunes — `components/ui` (importar de `'../ui'` o `'../../components/ui'`)

| Pieza | Para qué |
|---|---|
| `PageHeader` | Toda pantalla empieza con esto: `title`, `subtitle`, `breadcrumbs` (usá `migasDe(path)` de `components/layout/navConfig`), `actions` (botones; el principal `variant="contained"` al final), `back` (ruta o -1). Pone el título de la pestaña. |
| `PageContainer` | Ancho máximo. `angosto` para formularios y configuración. |
| `SectionCard` | La tarjeta de la familia (borde fino, 14 px de radio), con `title`, `subtitle`, `action`, `noPadding`. **No usar `Paper elevation={3}`** ni sombras propias. |
| `DataTableResponsive` | Tabla desde `md`, tarjetas debajo. `columns` (con `primary`, `secondary`, `hideInCard`, `hideBelow`), `rows`, `acciones(row)`, `onRowClick`, `loading`, `empty`. **Nunca `minWidth` en una tabla.** |
| `StatusChip` | Estados: `label`, `tono` ('ok' \| 'aviso' \| 'error' \| 'info' \| 'acento' \| 'ia' \| 'neutro'), `vivo`. |
| `EmptyState` | Vacío: `title`, `description`, `icon` (componente Lucide), `action`, `compact`. |
| `BloqueEstado` | `estado="cargando"` o `estado="error"` con `onReintentar`. Un error de carga **nunca** se muestra como "No hay datos". |
| `ResponsiveDialog` | Todo diálogo de formulario: pantalla completa debajo de `sm`, X arriba, `actions` abajo con zona segura, no se cierra tocando afuera, `sucio` pregunta antes de descartar. |
| `ConfirmDialog` | Confirmaciones. `peligro` para lo destructivo; `textoATipear` para lo grave. El mensaje dice qué y cuánto ("Se van a dejar de enviar 1.140 mensajes"). |
| `KpiTile` | Indicador: `titulo`, `valor`, `unidad`, `leyenda`, `to`. |
| `WaBurbuja`, `formatoWhatsApp` | La burbuja de WhatsApp (una sola para toda la app) y el formato *negrita* _cursiva_ ~tachado~ sin innerHTML. |
| `VistaPreviaEmail` | HTML de un email en un iframe aislado y escalado. **Nunca** `dangerouslySetInnerHTML` con HTML de un email. |
| `AvatarUsuario`, `SelectorTema` | Avatar con iniciales de respaldo; Claro/Oscuro/Sistema. |

Otros: `utils/descargar.js` (`descargarCsv`, `descargarBlob`), `components/campanias/estados.js` (estados de campaña
en los tres canales), `permisos.js` (catálogo de permisos).

## Contextos y hooks

- `useFeedback()` de `context/FeedbackContext`: `exito(msg)`, `error(msg, { accion: { etiqueta, onClick } })`,
  `aviso`, `info`. **Es el único aviso de la app**: nada de Snackbars propios, `alert()`, `window.confirm` ni errores
  solo a la consola. `mensajeDeError(err, generico)` saca el mensaje del backend.
- Socket único — `context/SocketContext`: `useEventoSocket(evento, handler)`, `useSalaSocket('join_campaña', id)`
  / `useSalaSocket('join_inbox')`, `useAlReanudar(fn)` (al reconectar o volver de segundo plano: recargar).
  **Nunca** `io()` en una pantalla.
- `useAuth()`: `hasPermiso`, `user` (payload del token: `sub`, `permisos`…), `usuario` (nombre, foto), `nombre`.
- `usePwa()` de `pwa`: instalación, push, conexión.

## Reglas

1. **Colores del tema, nunca a mano**: `primary.main`, `text.secondary`, `divider`, `success.main`, `warning.dark`,
   `background.default`, `action.hover`… Nada de `#075E54`, `#25D366`, `#1976d2`, `green`, `red`, ni pares
   claro/oscuro escritos a mano. Las únicas excepciones son la marca (el logo) y el QR (fondo blanco).
2. **Sin degradados, sin brillos, sin `scale` al pasar el mouse, sin emojis como íconos, sin Helvetica.** La IA va
   en `ia.main` (violeta) con borde, como amaIA en Gestión.
3. **Íconos de Lucide** (`lucide-react`, `size={18|20}`, `strokeWidth={1.75}`, `aria-hidden`). Reemplazá los de
   `@mui/icons-material` y `react-icons` en los archivos que toques.
4. **Breakpoints del tema** (`theme.breakpoints.down('md')`, `sx={{ display: { xs, md } }}`). Nada de
   `'(max-width:768px)'`.
5. **Grid de MUI 7**: las props `item`, `xs`, `sm`, `md` en `<Grid>` se ignoran en silencio. Usá `size={{ xs: 12, md: 6 }}`
   o, mejor, `Box` con `display: 'grid'` y `gridTemplateColumns`.
6. **Celular**: todo lo que se toca mide 44 px o más debajo de `md` (botones de ícono `width/height: 44`). Letra
   mínima 12 px (los rótulos de 11 px en mayúsculas son la excepción). Los campos ya tienen 16 px por el tema; un
   `<input>`/`<textarea>` nativo necesita `fontSize: 16` en el celular. Nada que solo aparezca con hover o click
   derecho: las acciones secundarias van a un menú "Más" (`MoreVertical`) con texto.
7. **Una acción principal por pantalla y por fila**, con texto. Las demás, al menú "Más".
8. **Lo que corta un envío o borra datos se confirma** con `ConfirmDialog` diciendo qué y cuánto. Los botones que
   disparan un pedido se deshabilitan mientras corre (no hay doble envío).
9. **Lo que se ve está en la URL** (`useSearchParams`): la pestaña, los filtros de búsqueda, el elemento abierto. El
   atrás de Android tiene que hacer lo esperable.
10. **Castellano y palabras del negocio**: Plantillas (no Templates), Respuestas rápidas, Línea, Cuenta de email.
    Estados traducidos con su chip (nada de `delivered`, `completed`, `REPORTE_EMAIL_DIARIO`). Fechas con
    `toLocaleString('es-AR', …)`.
11. **Sin `console.log`** en lo que toques.
12. **Fechas de filtros**: un "hasta" de un día incluye ese día entero (23:59:59.999 local), no medianoche UTC.

## Verificación de cada pantalla

`cd frontend && npm run build` sin errores. Revisá mentalmente cada pantalla a 360 px: sin scroll horizontal, sin
anchos fijos mayores a 280 px fuera de un objeto por breakpoint, botones de 44 px, diálogos a pantalla completa.
