/**
 * Reemplaza variables {{varName}} en un string con los valores del objeto datos.
 * Misma lógica que el backend (renderTemplate.ts).
 */
export function renderTemplate(template, datos) {
    if (!template) return '';
    return template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
        const value = datos[key];
        return value !== undefined && value !== null ? String(value) : '';
    });
}
