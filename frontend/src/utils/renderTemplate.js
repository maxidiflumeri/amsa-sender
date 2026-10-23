/**
 * Reemplaza variables {{varName}} en un string con los valores del objeto datos.
 * Misma lógica que el backend (renderTemplate.ts).
 *
 * `conservarFaltantes`: para las vistas previas, una variable sin dato queda escrita como `{{nombre}}` en vez de
 * desaparecer, así se nota que a esa plantilla le falta un dato en vez de verse un texto "limpio" pero engañoso.
 * El envío real no lo usa: allá una variable sin dato va vacía.
 */
export function renderTemplate(template, datos, { conservarFaltantes = false } = {}) {
    if (!template) return '';
    const origen = datos ?? {};
    return template.replace(/{{\s*(\w+)\s*}}/g, (completo, key) => {
        const value = origen[key];
        if (value !== undefined && value !== null) return String(value);
        return conservarFaltantes ? completo : '';
    });
}
