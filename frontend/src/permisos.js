// El catálogo de permisos de Sender, con los nombres que ve la gente. Lo usan Roles y Mi perfil (antes estaba
// escrito a mano dentro de Roles, dos veces). Si el backend suma un permiso, va acá.

export const CATALOGO_PERMISOS = [
    {
        seccion: 'Conversaciones',
        items: [
            { key: 'wapi.inbox', label: 'Atender sus conversaciones' },
            { key: 'wapi.inbox.admin', label: 'Ver todas y asignar' },
            { key: 'wapi.respuestas_rapidas', label: 'Respuestas rápidas' },
        ],
    },
    {
        seccion: 'WhatsApp API',
        items: [
            { key: 'wapi.campanias', label: 'Campañas y monitor' },
            { key: 'wapi.templates', label: 'Plantillas' },
            { key: 'wapi.analitica', label: 'Analítica y reportes' },
            { key: 'wapi.bajas', label: 'Bajas' },
            { key: 'wapi.config', label: 'Líneas' },
        ],
    },
    {
        seccion: 'Email',
        items: [
            { key: 'email.campanias', label: 'Campañas' },
            { key: 'email.envio_manual', label: 'Envío manual' },
            { key: 'email.templates', label: 'Plantillas' },
            { key: 'email.reportes', label: 'Reportes' },
            { key: 'email.desuscripciones', label: 'Desuscripciones' },
            { key: 'email.cuentas_smtp', label: 'Cuentas de email' },
        ],
    },
    {
        seccion: 'WhatsApp Web',
        items: [
            { key: 'whatsapp.sesiones', label: 'Sesiones' },
            { key: 'whatsapp.conectar', label: 'Conectar sesiones' },
            { key: 'whatsapp.campanias', label: 'Campañas' },
            { key: 'whatsapp.templates', label: 'Plantillas' },
            { key: 'whatsapp.reportes', label: 'Reportes' },
            { key: 'whatsapp.metricas', label: 'Métricas' },
        ],
    },
    {
        seccion: 'Deudores',
        items: [
            { key: 'deudores.ver', label: 'Buscar y ver fichas' },
            { key: 'deudores.reportes', label: 'Reportes por empresa y remesa' },
        ],
    },
    {
        seccion: 'Configuración',
        items: [
            { key: 'config.tareas_programadas', label: 'Tareas programadas' },
            { key: 'admin.usuarios', label: 'Usuarios y roles' },
        ],
    },
];

export const TOTAL_PERMISOS = CATALOGO_PERMISOS.reduce((n, s) => n + s.items.length, 0);

/** El nombre visible de un permiso (o la clave, si no está en el catálogo). */
export function nombrePermiso(key) {
    for (const s of CATALOGO_PERMISOS) {
        const it = s.items.find((i) => i.key === key);
        if (it) return it.label;
    }
    return key;
}
