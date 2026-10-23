// Descargas de archivos. Antes había cinco copias del armado de CSV.

/** Descarga un Blob con un nombre. */
export function descargarBlob(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function celda(v) {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Arma y descarga un CSV (con BOM, para que Excel lea bien los acentos).
 * @param {string} nombre
 * @param {{key: string, label: string, valor?: (fila: any) => any}[]} columnas
 * @param {any[]} filas
 * @param {string} [separador] ';' por defecto, como lo abre Excel en castellano.
 */
export function descargarCsv(nombre, columnas, filas, separador = ';') {
    const encabezado = columnas.map((c) => celda(c.label)).join(separador);
    const cuerpo = filas.map((f) => columnas.map((c) => celda(c.valor ? c.valor(f) : f[c.key])).join(separador));
    const blob = new Blob(['﻿' + [encabezado, ...cuerpo].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    descargarBlob(blob, nombre.endsWith('.csv') ? nombre : `${nombre}.csv`);
}
