import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { chunk } from 'lodash';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs/promises';
import { parseCsvEmail } from 'src/modules/whatsapp/campanias/utils/csv-parser';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';

@Injectable()
export class CampaniasEmailService {
    private readonly logger = new Logger(CampaniasEmailService.name);

    constructor(
        private readonly prisma: PrismaService,
        @InjectQueue('emailsEnvios') private readonly emailsEnvios: Queue,
    ) { }

    async obtenerCampañas() {
        this.logger.log('🔍 Buscando campañas activas...');
        return this.prisma.campañaEmail.findMany({
            where: { archivada: false, nombre: { not: '__envios_manuales__' } },
            include: { contactos: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async obtenerCampañasLite() {
        this.logger.log('🔍 Buscando campañas (lite)…');
        return this.prisma.campañaEmail.findMany({
            where: { archivada: false, nombre: { not: '__envios_manuales__' } },
            select: {
                id: true,
                nombre: true,
                estado: true,
                createdAt: true,
                enviadoAt: true,
                agendadoAt: true,
                _count: { select: { contactos: true } }, // 👈 contador
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async contactosPorCampania(
        campañaId: number,
        opts: { page?: string | number; size?: string | number; q?: string } = {},
    ) {
        const pageNum = Math.max(Number(opts.page || 1), 1);
        const sizeNum = Math.min(Math.max(Number(opts.size || 100), 1), 1000000);
        const skip = (pageNum - 1) * sizeNum;

        const where: any = { campañaId };
        if (opts.q && String(opts.q).trim().length > 0) {
            const q = String(opts.q).trim();
            where.OR = [
                { email: { contains: q, mode: 'insensitive' } },
                // Si más adelante querés búsquedas en JSON (según motor/versión):
                // { datos: { path: ['nombre'], string_contains: q } },
            ];
        }

        this.logger.log(`📧 Contactos campaña=${campañaId} page=${pageNum} size=${sizeNum} q="${opts.q ?? ''}"`);

        const [items, total] = await this.prisma.$transaction([
            this.prisma.contactoEmail.findMany({
                where,
                skip,
                take: sizeNum,
                orderBy: { id: 'asc' },
                select: {
                    id: true,
                    email: true,
                    datos: true,
                },
            }),
            this.prisma.contactoEmail.count({ where }),
        ]);

        return { items, total, page: pageNum, size: sizeNum };
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
                    createdAt: new Date()
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

    async forzarCierre(id: number, nuevoEstado: 'finalizada' | 'error') {
        this.logger.log(`🔧 Forzando cierre de campaña email ${id} → ${nuevoEstado}`);
        const campaña = await this.prisma.campañaEmail.findUnique({ where: { id }, select: { id: true, jobId: true } });
        if (!campaña) throw new NotFoundException('Campaña no encontrada');

        if (campaña.jobId) {
            try {
                const job: Job | undefined = await this.emailsEnvios.getJob(campaña.jobId);
                if (job) {
                    const state = await job.getState();
                    if (['waiting', 'delayed', 'active'].includes(state)) await job.remove();
                }
            } catch (e) {
                this.logger.warn(`⚠️ No se pudo cancelar job ${campaña.jobId}: ${e.message}`);
            }
        }

        await this.prisma.campañaEmail.update({ where: { id }, data: { estado: nuevoEstado } });
        return { ok: true };
    }

    async eliminarCampaña(id: number) {
        this.logger.log(`🗑️ Eliminando campaña ${id}`);
        const campaña = await this.prisma.campañaEmail.findUnique({ where: { id } });

        if (!campaña) throw new NotFoundException('Campaña no encontrada');
        if (campaña.estado === 'procesando') {
            this.logger.warn(`❌ No se puede eliminar campaña ${id} porque está procesando`);
            throw new BadRequestException('No se puede eliminar una campaña en proceso. Forzá su cierre primero.');
        }

        if (campaña.jobId) {
            try {
                const job: Job | undefined = await this.emailsEnvios.getJob(campaña.jobId);
                if (job) {
                    await job.remove();
                    this.logger.log(`🗑️ Job ${campaña.jobId} eliminado de la cola.`);
                }
            } catch (err) {
                this.logger.warn(`⚠️ No se pudo eliminar el job ${campaña.jobId}: ${err.message}`);
            }
        }

        await this.prisma.contactoEmail.deleteMany({ where: { campañaId: campaña.id } });
        await this.prisma.campañaEmail.update({
            where: { id: campaña.id },
            data: { archivada: true },
        });

        this.logger.log(`✅ Campaña ${id} archivada y contactos eliminados`);
        return { message: 'Campaña eliminada con contactos. Reportes conservados.' };
    }
}