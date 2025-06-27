import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class MensajesService {
    private readonly logger = new Logger(MensajesService.name);

    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue('colaEnvios') private readonly colaEnvios: Queue
    ) { }

    async encolarEnvio(body: any) {
        const { sessionIds, campaña, config = {} } = body;

        try {
            await this.prisma.campaña.update({
                where: { id: campaña },
                data: {
                    estado: 'procesando',
                    sesiones: JSON.stringify(sessionIds),
                    config
                }
            });

            await this.colaEnvios.add('enviar', { sessionIds, campaña, config });
            return { message: 'Envío encolado correctamente' };
        } catch (err) {
            this.logger.error('Error al encolar campaña', err);
            await this.prisma.campaña.update({ where: { id: campaña }, data: { estado: 'pendiente' } });
            throw new Error('No se pudo encolar la campaña');
        }
    }

    async obtenerMetricas(campaniaId: number) {
        try {
            const enviados = await this.prisma.mensaje.count({
                where: { campañaId: campaniaId, fromMe: true }
            });

            const respuestas = await this.prisma.mensaje.findMany({
                where: {
                    campañaId: campaniaId,
                    fromMe: false
                },
                select: { numero: true }
            });

            const contactosRespondieron = new Set(respuestas.map(r => r.numero)).size;
            const totalRespuestas = respuestas.length;

            return {
                enviados,
                contactosRespondieron,
                totalRespuestas,
                porcentajeRespondieron: enviados > 0 ? (contactosRespondieron / enviados) * 100 : 0
            };
        } catch (error) {
            this.logger.error('Error al obtener métricas:', error);
            throw new Error('No se pudo obtener métricas.');
        }
    }

    async guardarMensaje(data: {
        numero: string;
        campañaId?: number;
        ani: string;
        mensaje: string;
        fromMe: boolean;
        fecha: Date;
        tipo: string;
    }) {
        return this.prisma.mensaje.create({
            data: {
                ...data,
                campañaId: data.campañaId ?? null,
                fecha: new Date(data.fecha)
            }
        });
    }

    async crearMensaje(body: any) {
        try {
            const { numero, campañaId, ani, mensaje, fromMe, fecha, tipo } = body;

            return await this.prisma.mensaje.create({
                data: {
                    numero,
                    campañaId: campañaId ? Number(campañaId) : null,
                    ani,
                    mensaje,
                    fromMe,
                    fecha: new Date(fecha),
                    tipo,
                }
            });
        } catch (error) {
            this.logger.error('Error al guardar mensaje:', error);
            throw error;
        }
    }

    async obtenerMensajes(campañaId?: number) {
        return this.prisma.mensaje.findMany({
            where: {
                campañaId: campañaId ? campañaId : undefined
            },
            orderBy: {
                fecha: 'asc'
            }
        });
    }
}