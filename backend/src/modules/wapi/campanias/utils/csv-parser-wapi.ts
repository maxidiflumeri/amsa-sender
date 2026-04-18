import * as fs from 'fs';
const csv = require('csv-parser');

export interface ContactoWapiCsv {
  numero: string;
  nombre?: string;
  datos: Record<string, string>;
  rawRow: Record<string, any>;
}

/** Parsea CSV con columna obligatoria "numero" (E.164) y cualquier otra columna como datos */
export function parseCsvWapi(filePath: string): Promise<ContactoWapiCsv[]> {
  const contactos: ContactoWapiCsv[] = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row: Record<string, string>) => {
        const numero = row['numero']?.trim().replace(/\s+/g, '');
        if (!numero) return;

        const { numero: _, ...resto } = row;
        contactos.push({
          numero,
          nombre: resto['nombre']?.trim() || undefined,
          datos: Object.fromEntries(
            Object.entries(resto).map(([k, v]) => [k.trim(), String(v ?? '').trim()])
          ),
          rawRow: row,
        });
      })
      .on('end', () => resolve(contactos))
      .on('error', reject);
  });
}
