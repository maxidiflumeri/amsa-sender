import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Mensaje } from '@prisma/client';

@Injectable()
export class MensajesService {
    private readonly logger = new Logger(MensajesService.name);

    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue('colaEnvios') private readonly colaEnvios: Queue,
    ) { }

    async encolarEnvio(body: any) {
        const { sessionIds, campaña, config = {} } = body;
        this.logger.log(`📨 Encolando campaña ${campaña} con sesiones: ${JSON.stringify(sessionIds)}`);

        try {
            await this.prisma.campaña.update({
                where: { id: campaña },
                data: {
                    estado: 'procesando',
                    sesiones: JSON.stringify(sessionIds),
                    config,
                },
            });

            await this.colaEnvios.add('enviar', { sessionIds, campaña, config });

            this.logger.log(`✅ Campaña ${campaña} encolada correctamente`);
            return { message: 'Envío encolado correctamente' };
        } catch (err) {
            this.logger.error(`❌ Error al encolar campaña ${campaña}: ${err.message}`, err.stack);
            await this.prisma.campaña.update({
                where: { id: campaña },
                data: { estado: 'pendiente' },
            });
            throw new Error('No se pudo encolar la campaña');
        }
    }

    async obtenerMetricas(campaniaId: number) {
        this.logger.log(`📊 Obteniendo métricas para campaña ${campaniaId}`);

        try {
            const enviados = await this.prisma.mensaje.count({
                where: { campañaId: campaniaId, fromMe: true },
            });

            const respuestas = await this.prisma.mensaje.findMany({
                where: {
                    campañaId: campaniaId,
                    fromMe: false,
                },
                select: { numero: true },
            });

            const contactosRespondieron = new Set(respuestas.map((r) => r.numero)).size;
            const totalRespuestas = respuestas.length;

            const porcentajeRespondieron =
                enviados > 0 ? (contactosRespondieron / enviados) * 100 : 0;

            this.logger.log(
                `📈 Enviados: ${enviados}, Respuestas: ${totalRespuestas}, Contactos únicos: ${contactosRespondieron}, Porcentaje: ${porcentajeRespondieron.toFixed(2)}%`,
            );

            return {
                enviados,
                contactosRespondieron,
                totalRespuestas,
                porcentajeRespondieron,
            };
        } catch (error) {
            this.logger.error(`❌ Error al obtener métricas: ${error.message}`, error.stack);
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
        this.logger.debug(
            `💾 Guardando mensaje para ${data.numero} [fromMe: ${data.fromMe}]`,
        );
        return this.prisma.mensaje.create({
            data: {
                ...data,
                campañaId: data.campañaId ?? null,
                fecha: new Date(data.fecha),
            },
        });
    }

    async crearMensaje(body: any) {
        const { numero, campañaId, ani, mensaje, fromMe, fecha, tipo } = body;
        this.logger.log(
            `✍️ Creando mensaje manual para ${numero} en campaña ${campañaId}`,
        );
        try {
            return await this.prisma.mensaje.create({
                data: {
                    numero,
                    campañaId: campañaId ? Number(campañaId) : null,
                    ani,
                    mensaje,
                    fromMe,
                    fecha: new Date(fecha),
                    tipo,
                },
            });
        } catch (error) {
            this.logger.error(`❌ Error al guardar mensaje: ${error.message}`, error.stack);
            throw error;
        }
    }

    async obtenerMensajes(campañaId?: number) {
        this.logger.log(
            `📚 Obteniendo mensajes ${campañaId ? 'para campaña ' + campañaId : ''}`,
        );
        return this.prisma.mensaje.findMany({
            where: {
                campañaId: campañaId ? campañaId : undefined,
            },
            orderBy: {
                fecha: 'asc',
            },
        });
    }

    async obtenerMensajesEntreEnvios(
        campañaId: number,
        numero: string,
    ): Promise<Mensaje[]> {
        this.logger.log(
            `🔍 Buscando mensajes de ${numero} entre envíos de campaña ${campañaId}`,
        );

        const reporteActual = await this.prisma.reporte.findFirst({
            where: {
                campañaId,
                numero,
                enviadoAt: { not: null },
            },
            orderBy: { enviadoAt: 'asc' },
            select: {
                enviadoAt: true,
            },
        });

        if (!reporteActual?.enviadoAt) {
            this.logger.warn(
                `⚠️ No se encontró fecha de envío en campaña ${campañaId} para ${numero}`,
            );
            throw new Error('No se encontró fecha de envío para este número en la campaña');
        }

        const desde = reporteActual.enviadoAt;

        const siguienteReporte = await this.prisma.reporte.findFirst({
            where: {
                numero,
                campañaId: { not: campañaId },
                enviadoAt: { gt: desde },
            },
            orderBy: { enviadoAt: 'asc' },
            select: { enviadoAt: true },
        });

        const hasta = siguienteReporte?.enviadoAt || new Date();
        this.logger.debug(`📆 Rango de búsqueda: desde ${desde.toISOString()} hasta ${hasta.toISOString()}`);

        return this.prisma.mensaje.findMany({
            where: {
                numero,
                fecha: {
                    gte: desde,
                    lt: hasta,
                },
            },
            orderBy: { fecha: 'asc' },
        });
    }
}