// Formateadores compartidos por las pantallas de analítica y reportes. Antes cada una tenía su copia de `formatMs` y
// `formatFecha`, y los números salían sin separador de miles.

const FECHA_HORA = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };

/** 1234 -> "1.234". Sin dato, un guion largo. */
export function fmtNumero(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('es-AR');
}

/** Fecha y hora en es-AR. */
export function fmtFecha(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-AR', FECHA_HORA);
}

export function fmtHora(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** "2026-10-23" -> "23/10" (para los ejes de los gráficos). */
export function fmtDiaCorto(iso) {
    if (!iso) return '';
    const [, m, d] = String(iso).slice(0, 10).split('-');
    return m && d ? `${d}/${m}` : String(iso);
}

/** Milisegundos a "45s", "3m 12s" o "2h 5m". */
export function fmtDuracion(ms) {
    if (!ms) return '—';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** Porcentaje de `parte` sobre `total`, null-safe: sin total devuelve 0. */
export function porcentaje(parte, total, decimales = 1) {
    const p = Number(parte);
    const t = Number(total);
    if (!t || Number.isNaN(p) || Number.isNaN(t)) return 0;
    return Number(((p / t) * 100).toFixed(decimales));
}

/** Un porcentaje que puede venir null/undefined/string desde el backend. */
export function fmtPct(valor, decimales = 1) {
    const n = Number(valor);
    if (valor === null || valor === undefined || Number.isNaN(n)) return '—';
    return `${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: decimales })}%`;
}

/** La fecha local como "YYYY-MM-DD". `toISOString()` da la de UTC: de noche en Argentina ya es "mañana". */
export function aDiaLocal(fecha = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}

/** Hace `dias` días, como "YYYY-MM-DD" local. */
export function diaLocalHaceDias(dias) {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return aDiaLocal(d);
}
