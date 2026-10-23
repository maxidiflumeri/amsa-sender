// Los errores de las páginas públicas no pasan por el FeedbackContext (no hay sesión ni marco): se arma el texto acá.
/** El mensaje de un error de una página pública: el backend a veces devuelve un texto y a veces un objeto. */
export function mensajePublico(err, generico) {
    const data = err?.response?.data;
    if (typeof data === 'string' && data.trim() && data.length < 200) return data;
    const m = data?.message;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string' && m.trim()) return m;
    return generico;
}
