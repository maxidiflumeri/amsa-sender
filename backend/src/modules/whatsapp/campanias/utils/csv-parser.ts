import * as fs from 'fs';
const csv = require('csv-parser');

export interface ContactoCsv {
    numero: string;
    mensaje?: string;
    datos: Record<string, any>;
}

export async function parseCsv(filePath: string): Promise<ContactoCsv[]> {
    const contactos: ContactoCsv[] = [];

    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
                const numero = data['numero']?.trim();
                if (!numero) return;

                const mensaje = data['mensaje']?.trim();
                const { numero: _, mensaje: __, ...otrosCampos } = data;

                contactos.push({
                    numero,
                    mensaje: mensaje || null,
                    datos: otrosCampos,
                });
            })
            .on('end', () => resolve(contactos))
            .on('error', reject);
    });
}