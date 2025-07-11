import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { chunk } from 'lodash';
import { PrismaService } from 'src/prisma/prisma.service';

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

    async crearCampañaEmail(dto: {
        nombre: string;
        contactos: { email: string; datos: any; }[];
        userId: number;
    }) {
        try {
            console.log('entre al servicio de crear campaña de email');
            const { nombre, contactos, userId } = dto;

            // 1. Crear campaña
            const campania = await this.prisma.campañaEmail.create({
                data: {
                    nombre,
                    userId,
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