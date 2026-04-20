/**
 * Mapeo estático de ID de empresa (proveniente del sistema VFP) a su nombre legible.
 *
 * Las empresas son un conjunto estable: se agrega una nueva con muy poca frecuencia,
 * por lo que mantenerlo en código evita el costo de una tabla dedicada.
 *
 * Para agregar una nueva empresa: sumá una entrada aquí y redeploy.
 */
export const EMPRESAS_MAP: Readonly<Record<string, string>> = Object.freeze({
  '00': 'Todas',
  '13': 'Ahorristas Peugeot/Citr',
  '14': 'Peugeot/Citroen',
  '17': 'Toyota',
  '21': 'Fiat',
  '22': 'Movistar_legales',
  '24': 'Fiat Mora Temprana',
  '26': 'Claro Pl',
  '30': 'Telecom',
  '31': 'Telecom_personal',
  '32': 'Telecom Fraudes',
  '34': 'Toyota Plan De Ahorro',
  '35': 'Fuller /Tupperware',
  '36': 'Plan Rombo S.a.',
  '41': 'Fiat Plan',
  '43': 'Jeep Ram Plan',
  '44': 'Toyota Refinanciacion',
  '49': 'Peugeot Citroen (Par)',
  '60': 'Aysa',
  '73': 'Uala',
  '74': 'Ausa',
  '79': 'Toyota Relevamiento',
  '85': 'Toyota 0800',
  '87': 'Toyota Venta Seguros',
  '94': 'Fibertel',
});

/**
 * Obtiene el nombre legible para un ID de empresa.
 * Si el ID no está mapeado, devuelve el propio ID como fallback.
 */
export function getNombreEmpresa(id: string | null | undefined): string {
  if (id === null || id === undefined) return '';
  return EMPRESAS_MAP[id] ?? id;
}

/**
 * Indica si un ID de empresa está mapeado a un nombre legible.
 * Se usa para filtrar del listado público sólo empresas "conocidas".
 */
export function isEmpresaMapeada(id: string | null | undefined): boolean {
  if (id === null || id === undefined) return false;
  return Object.prototype.hasOwnProperty.call(EMPRESAS_MAP, id);
}
