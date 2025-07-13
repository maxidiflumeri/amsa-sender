import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { chunk } from 'lodash';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs/promises';
import { parseCsvEmail } from 'src/modules/whatsapp/campanias/utils/csv-parser';

@Injectable()
export class CampaniasEmailService {
    private readonly logger = new Logger(CampaniasEmailService.name);

    constructor(private readonly prisma: PrismaService) { }

    async obtenerCampañas() {
        this.logger.log('🔍 Buscando campañas activas...');
        return this.prisma.campañaEmail.findMany({
            where: { archivada: false },
            include: { contactos: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async crearCampañaEmail(dto: { nombre: string; userId: string; }, filePath: string) {
        this.logger.log(`📥 Creando campaña de email: ${dto.nombre}`);
        try {
            const { nombre, userId } = dto;
            const contactos = await parseCsvEmail(filePath);

            // 1. Crear campaña
            const campania = await this.prisma.campañaEmail.create({
                data: {
                    nombre,
                    userId: parseInt(userId),
                },
            });

            // 2. Agregar contactos en bloques de 10.000
            const bloques = chunk(contactos, 10000);
            for (const grupo of bloques) {
                await this.prisma.contactoEmail.createMany({
                    data: grupo.map((c) => ({
                        email: c.email,
                        datos: c.datos,
                        campañaId: campania.id,
                    })),
                });
            }

            await fs.unlink(filePath);
            this.logger.log(`🧹 Archivo CSV eliminado: ${filePath}`);

            return {
                id: campania.id,
                totalContactos: contactos.length,
                mensaje: 'Campaña creada correctamente',
            };
        } catch (error) {
            console.log('Error al crear campaña de email:', error);
            console.log(error.message)
            throw new InternalServerErrorException('Error al crear campaña de email: ' + error.message);
        }
    }
}