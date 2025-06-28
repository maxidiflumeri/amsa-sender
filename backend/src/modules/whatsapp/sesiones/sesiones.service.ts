import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import { PrismaService } from 'src/prisma/prisma.service';
import { Redis } from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SesionesService implements OnModuleInit {
    private readonly logger = new Logger(SesionesService.name);
    private readonly sesiones: Record<string, any> = {};
    private redis: Redis;

    constructor(private readonly prisma: PrismaService) { }

    async onModuleInit() {
        this.logger.log('🚀 Inicializando SesionesService y conectando a Redis...');
        this.redis = new Redis({
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT || '6379'),
            maxRetriesPerRequest: null,
        });
        await this.cargarSesionesActivas();
    }

    getSesion(id: string) {
        return this.sesiones[id];
    }

    getSesionesActivas() {
        return Object.entries(this.sesiones).map(([id, s]) => ({
            id,
            estado: s.estado,
            ani: s.ani,
        }));
    }

    async conectarNuevaSesion(sessionId: string) {
        this.logger.log(`🔌 Iniciando nueva sesión: ${sessionId}`);
        const client = new Client({
            authStrategy: new LocalAuth({ clientId: sessionId }),
            puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
        });

        this.sesiones[sessionId] = { client, estado: 'inicializando' };

        client.on('qr', (qr) => {
            this.logger.log(`📲 QR generado para sesión ${sessionId}`);
            this.sesiones[sessionId].qr = qr;
            this.sesiones[sessionId].estado = 'esperando escaneo';
            this.redis.publish('estado-sesion', JSON.stringify({ estado: 'qr', qr, ani: '', sessionId }));
        });

        client.on('authenticated', async () => {
            this.logger.log(`🔐 Sesión ${sessionId} autenticada`);
            this.sesiones[sessionId].estado = 'iniciando_sesion';
            await this.redis.publish('estado-sesion', JSON.stringify({ estado: 'iniciando_sesion', qr: '', ani: '', sessionId }));
        });

        client.on('ready', async () => {
            const ani = `${client.info.wid.user}-${client.info.pushname}`;
            this.sesiones[sessionId].estado = 'conectado';
            this.sesiones[sessionId].ani = ani;

            await this.redis.publish('estado-sesion', JSON.stringify({ estado: 'conectado', qr: '', ani, sessionId }));

            await this.prisma.sesion.upsert({
                where: { sessionId },
                update: { estado: 'conectado', ani },
                create: { sessionId, estado: 'conectado', ani },
            });

            this.logger.log(`✅ Sesión ${sessionId} conectada como ${ani}`);
        });

        client.on('auth_failure', (msg) => {
            this.logger.warn(`❌ Fallo de autenticación en sesión ${sessionId}: ${msg}`);
            this.redis.publish('estado-sesion', JSON.stringify({ estado: 'fallo_autenticacion', sessionId, mensaje: msg }));
        });

        client.on('disconnected', async () => {
            this.logger.log(`⚠️ Sesión ${sessionId} desconectada`);
            this.sesiones[sessionId].estado = 'desconectado';
            await this.prisma.sesion.update({ where: { sessionId }, data: { estado: 'desconectado' } });
            await this.redis.publish('estado-sesion', JSON.stringify({ estado: 'desconectado', qr: '', ani: '', sessionId }));
        });

        client.on('message', async (msg) => {
            await this.registrarMensaje({ msg, client, sessionId });
        });

        client.on('message_create', async (msg) => {
            if (msg.fromMe) {
                await this.registrarMensaje({ msg, client, sessionId });
            }
        });

        await client.initialize().catch((error) => {
            this.logger.error(`❌ Error al inicializar sesión ${sessionId}: ${error.message}`, error.stack);
        });
    }

    async cargarSesionesActivas() {
        this.logger.log('🔄 Cargando sesiones activas desde la base de datos...');
        const sesionesDB = await this.prisma.sesion.findMany({ where: { estado: 'conectado' } });
        for (const { sessionId } of sesionesDB) {
            try {
                await this.reconectarSesion(sessionId);
            } catch (err) {
                this.logger.error(`❌ Error reconectando sesión ${sessionId}: ${err.message}`, err.stack);
            }
        }
    }

    async reconectarSesion(sessionId: string) {
        this.logger.log(`🔁 Reintentando conexión de sesión ${sessionId}...`);
        const client = new Client({
            authStrategy: new LocalAuth({ clientId: sessionId }),
            puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
        });

        this.sesiones[sessionId] = { client, estado: 'reconectando' };

        client.on('ready', async () => {
            const ani = `${client.info.wid.user}-${client.info.pushname}`;
            this.sesiones[sessionId] = { client, estado: 'conectado', ani };
            await this.prisma.sesion.update({ where: { sessionId }, data: { estado: 'conectado', ani } });
            await this.redis.publish('estado-sesion', JSON.stringify({ estado: 'conectado', qr: '', ani, sessionId }));
            this.logger.log(`✅ Sesión ${sessionId} reconectada como ${ani}`);
        });

        client.on('message', async (msg) => {
            await this.registrarMensaje({ msg, client, sessionId });
        });

        client.on('message_create', async (msg) => {
            if (msg.fromMe) {
                await this.registrarMensaje({ msg, client, sessionId });
            }
        });

        client.on('auth_failure', (msg) => {
            this.sesiones[sessionId].estado = 'fallo de autenticación';
            this.logger.warn(`❌ Auth failure en sesión ${sessionId}: ${msg}`);
        });

        client.on('disconnected', async () => {
            this.sesiones[sessionId].estado = 'desconectado';
            await this.prisma.sesion.update({ where: { sessionId }, data: { estado: 'desconectado' } });
            this.logger.log(`⚠️ Sesión ${sessionId} desconectada`);
        });

        await client.initialize();
        return this.sesiones[sessionId];
    }

    async limpiarSesiones() {
        for (const id of Object.keys(this.sesiones)) {
            await this.eliminarSesionPorId(id);
        }
        this.logger.log('🧹 Todas las sesiones en memoria fueron limpiadas.');
    }

    async eliminarSesionPorId(sessionId: string) {
        const sesion = this.sesiones[sessionId];
        if (!sesion) {
            this.logger.warn(`⚠️ Intento de eliminar sesión no existente: ${sessionId}`);
            return;
        }

        const estado = sesion.estado;
        try {
            if (estado !== 'desconectado' && sesion?.client) {
                if (sesion.client.pupBrowser?.isConnected()) {
                    await sesion.client.pupBrowser.close().catch((err) => {
                        this.logger.warn(`⚠️ Error cerrando Puppeteer en sesión ${sessionId}: ${err.message}`);
                    });
                }
                await sesion.client.destroy();
            }
        } catch (err) {
            this.logger.error(`❌ Error al destruir sesión ${sessionId}: ${err.message}`, err.stack);
        }

        delete this.sesiones[sessionId];
        this.logger.log(`🗑️ Sesión ${sessionId} eliminada de memoria.`);
    }

    async borrarCarpetaSesion(sessionId: string) {
        const nombreCarpeta = `session-${sessionId}`;
        const ruta = path.join(__dirname, '..', '..', '..', '.wwebjs_auth', nombreCarpeta);
        if (fs.existsSync(ruta)) {
            await fs.promises.rm(ruta, { recursive: true, force: true });
            this.logger.log(`🗂️ Carpeta de sesión eliminada: ${nombreCarpeta}`);
        }
    }

    async borrarTodasLasCarpetasSesion() {
        const basePath = path.join(__dirname, '..', '..', '..', '.wwebjs_auth');
        const archivos = await fs.promises.readdir(basePath);
        const carpetasSesion = archivos.filter((nombre) => nombre.startsWith('session-'));
        for (const carpeta of carpetasSesion) {
            const ruta = path.join(basePath, carpeta);
            await fs.promises.rm(ruta, { recursive: true, force: true });
            this.logger.log(`🗂️ Carpeta eliminada: ${carpeta}`);
        }
    }

    private normalizarNumero(numeroRaw: string): string {
        return numeroRaw.replace('@c.us', '').replace('@s.whatsapp.net', '');
    }

    private async registrarMensaje({
        msg,
        client,
        sessionId,
    }: {
        msg: Message;
        client: Client;
        sessionId: string;
    }) {
        try {
            const fromMe = msg.fromMe;
            const numeroRaw = msg.fromMe ? msg.to : msg.from;
            const numero = this.normalizarNumero(numeroRaw);
            const ani = `${client.info.wid.user}-${client.info.pushname}`;
            const mensaje = msg.body;
            const fecha = msg.timestamp ? new Date(msg.timestamp * 1000) : new Date();
            const tipo = msg.type;
            let campañaId: number | null = null;

            if (!fromMe) {
                const ultimoEnviado = await this.prisma.mensaje.findFirst({
                    where: {
                        numero,
                        fromMe: true,
                        campañaId: { not: null },
                    },
                    orderBy: { fecha: 'desc' },
                });

                if (ultimoEnviado) {
                    const yaRespondido = await this.prisma.mensaje.findFirst({
                        where: {
                            numero,
                            fromMe: false,
                            campañaId: ultimoEnviado.campañaId,
                            fecha: { gt: ultimoEnviado.fecha },
                        },
                    });

                    if (!yaRespondido) {
                        campañaId = ultimoEnviado.campañaId;
                    }
                }
            }

            await this.prisma.mensaje.create({
                data: {
                    numero,
                    mensaje,
                    fromMe,
                    fecha,
                    tipo,
                    ani,
                    campañaId,
                },
            });

            this.logger.log(
                `[${fromMe ? 'ENVIADO' : 'RECIBIDO'}] ${numero}: ${mensaje} ${campañaId ? `(Campaña ${campañaId})` : ''}`,
            );
        } catch (err) {
            this.logger.error(`❌ Error registrando mensaje: ${err.message}`, err.stack);
        }
    }
}