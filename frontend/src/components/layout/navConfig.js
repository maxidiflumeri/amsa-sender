// El menú de Sender, en los bloques de AMSA Gestión (Operación, Envíos, Configuración). Cada ítem aparece solo si la
// persona tiene alguno de sus permisos; un grupo sin hijos visibles no aparece.

/**
 * @typedef {object} NavItem
 * @property {string} label
 * @property {string} [icon] Nombre del ícono de Lucide (ver IconoNav). Solo los de primer nivel.
 * @property {string} [path]
 * @property {string[]} [tambien] Otras rutas que marcan este ítem (pantallas que no están en el menú).
 * @property {NavItem[]} [children]
 * @property {string[]} [requiredPermissions] Alcanza con uno.
 * @property {'operacion'|'envios'|'configuracion'} [seccion]
 * @property {'conversaciones'|'campanias'} [indicador]
 */

export const TITULOS_SECCION = {
    operacion: 'Operación',
    envios: 'Envíos',
    configuracion: 'Configuración',
};

export const SECCIONES = ['operacion', 'envios', 'configuracion'];

/** @type {NavItem[]} */
export const navConfig = [
    { label: 'Inicio', icon: 'House', path: '/', seccion: 'operacion' },
    {
        label: 'Conversaciones',
        icon: 'MessagesSquare',
        path: '/wapi/inbox',
        seccion: 'operacion',
        indicador: 'conversaciones',
        requiredPermissions: ['wapi.inbox'],
    },
    {
        label: 'Deudores',
        icon: 'Users',
        seccion: 'operacion',
        children: [
            { label: 'Buscar', path: '/deudores', requiredPermissions: ['deudores.ver'] },
            { label: 'Reportes', path: '/deudores/reportes', requiredPermissions: ['deudores.reportes'] },
        ],
    },
    {
        label: 'WhatsApp API',
        icon: 'MessageCircle',
        seccion: 'envios',
        indicador: 'campanias',
        children: [
            { label: 'Campañas', path: '/wapi/campanias', requiredPermissions: ['wapi.campanias'] },
            { label: 'Monitor en vivo', path: '/wapi/live', requiredPermissions: ['wapi.campanias'] },
            { label: 'Plantillas', path: '/wapi/templates', requiredPermissions: ['wapi.templates'] },
            { label: 'Analítica', path: '/wapi/analitica', requiredPermissions: ['wapi.analitica'] },
            { label: 'Bajas', path: '/wapi/bajas', requiredPermissions: ['wapi.bajas'] },
        ],
    },
    {
        label: 'Email',
        icon: 'Mail',
        seccion: 'envios',
        children: [
            { label: 'Campañas', path: '/email/campanias', requiredPermissions: ['email.campanias'] },
            { label: 'Envío manual', path: '/email/envio-manual', requiredPermissions: ['email.envio_manual'] },
            { label: 'Plantillas', path: '/email/templates', tambien: ['/email/crearTemplate', '/preview-template'], requiredPermissions: ['email.templates'] },
            { label: 'Reportes', path: '/email/reportes', requiredPermissions: ['email.reportes'] },
            { label: 'Desuscripciones', path: '/email/desuscripciones', requiredPermissions: ['email.desuscripciones'] },
        ],
    },
    {
        label: 'WhatsApp Web',
        icon: 'Smartphone',
        seccion: 'envios',
        children: [
            { label: 'Sesiones', path: '/sesiones', tambien: ['/conectar'], requiredPermissions: ['whatsapp.sesiones'] },
            { label: 'Campañas', path: '/campanias', requiredPermissions: ['whatsapp.campanias'] },
            { label: 'Plantillas', path: '/templates', requiredPermissions: ['whatsapp.templates'] },
            { label: 'Reportes', path: '/reportes', requiredPermissions: ['whatsapp.reportes'] },
            { label: 'Métricas', path: '/metricas', requiredPermissions: ['whatsapp.metricas'] },
        ],
    },
    {
        label: 'Ajustes',
        icon: 'SlidersHorizontal',
        seccion: 'configuracion',
        children: [
            { label: 'Líneas de WhatsApp', path: '/wapi/config', requiredPermissions: ['wapi.config'] },
            { label: 'Cuentas de email', path: '/email/cuentas', requiredPermissions: ['email.cuentas_smtp'] },
            { label: 'Respuestas rápidas', path: '/config/respuestas-rapidas', requiredPermissions: ['wapi.respuestas_rapidas'] },
            { label: 'Tareas programadas', path: '/config/tareas-programadas', requiredPermissions: ['config.tareas_programadas'] },
        ],
    },
    {
        label: 'Administración',
        icon: 'ShieldCheck',
        seccion: 'configuracion',
        children: [
            { label: 'Usuarios', path: '/admin/usuarios', requiredPermissions: ['admin.usuarios'] },
            { label: 'Roles', path: '/admin/roles', requiredPermissions: ['admin.usuarios'] },
        ],
    },
];

/** Lo que la persona puede ver. */
export function filtrarItemsPorPermisos(items, tienePermiso) {
    return items
        .filter((item) => !item.requiredPermissions?.length || item.requiredPermissions.some((p) => tienePermiso(p)))
        .map((item) => ({ ...item, children: item.children ? filtrarItemsPorPermisos(item.children, tienePermiso) : undefined }))
        .filter((item) => !item.children || item.children.length > 0 || item.path);
}

/** Todas las pantallas a las que lleva el menú, con su grupo. */
export function pantallasDelMenu(items) {
    return items.flatMap((item) =>
        item.children
            ? item.children.filter((c) => c.path).map((c) => ({ item: c, grupo: item }))
            : item.path ? [{ item, grupo: null }] : [],
    );
}

function coincide(pathname, p) {
    return p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`);
}

/**
 * La ruta del menú que corresponde a la pantalla abierta: la más larga que coincide entera o como prefijo
 * (`/deudores/12` → Buscar, `/deudores/reportes` → Reportes). También cuentan las rutas de `tambien`.
 */
export function rutaActiva(pathname, items) {
    let mejor = null;
    let largo = -1;
    for (const { item } of pantallasDelMenu(items)) {
        for (const p of [item.path, ...(item.tambien ?? [])]) {
            if (coincide(pathname, p) && p.length > largo) {
                mejor = item.path;
                largo = p.length;
            }
        }
    }
    return mejor;
}

const partes = (pathname) => pathname.split('/').filter(Boolean);

/** Si al pasar de una ruta a otra la pantalla arranca desde arriba (igual que en Gestión). */
export function vuelveArriba(anterior, nueva) {
    if (anterior === nueva) return false;
    const clave = (p) => `${partes(p)[0] ?? ''}|${rutaActiva(p, navConfig) ?? ''}`;
    if (clave(anterior) !== clave(nueva)) return true;
    return partes(anterior).length < 2 || partes(nueva).length < 2;
}

/** La miga de pan de una pantalla del menú: `[{label: 'Envíos'}, {label: 'WhatsApp API'}]`. */
export function migasDe(path) {
    for (const item of navConfig) {
        if (item.path === path) return [{ label: TITULOS_SECCION[item.seccion] }];
        const hijo = item.children?.find((c) => c.path === path);
        if (hijo) return [{ label: TITULOS_SECCION[item.seccion] }, { label: item.label }];
    }
    return [];
}
