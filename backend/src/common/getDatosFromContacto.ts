import { JsonValue } from "@prisma/client/runtime/library";

export function getDatosFromContacto(datos: JsonValue): Record<string, any> {
    if (
        datos &&
        typeof datos === 'object' &&
        !Array.isArray(datos)
    ) {
        return datos as Record<string, any>;
    }

    return {}; // fallback si es null, array o primitivo
}