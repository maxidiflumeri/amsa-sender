import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import { PrismaService } from 'src/prisma/prisma.service';
import { Redis } from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import { getAuthBasePath, getSessionFolder } from 'src/common/auth-path.common';

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

    /**
     * Crea el cliente de whatsapp-web.js con la configuración común.
     * WWEBJS_WEB_VERSION permite fijar la versión de WhatsApp Web (servida desde .wwebjs_cache)
     * cuando una versión nueva rompe la inyección del Store y el evento 'ready' nunca llega.
     * Si el archivo de esa versión no está en caché, se carga la versión en vivo.
     */
    private crearCliente(sessionId: string): Client {
        const webVersion = process.env.WWEBJS_WEB_VERSION?.trim();
        if (webVersion) {
            this.logger.log(`📌 Sesión ${sessionId} usando WhatsApp Web fijado en ${webVersion}`);
        }
        return new Client({
            authStrategy: new LocalAuth({ clientId: sessionId, dataPath: getAuthBasePath() }),
            puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
            ...(webVersion ? { webVersion, webVersionCache: { type: 'local', strict: false } } : {}),
        });
    }

    /**
     * Si tras 'authenticated' no llega 'ready', la librería traga el error de inyección.
     * Este watchdog deja registrado el estado de la página para poder diagnosticarlo.
     */
    private vigilarReady(sessionId: string, client: Client) {
        const timeoutMs = 90_000;
        setTimeout(async () => {
            const sesion = this.sesiones[sessionId];
            if (!sesion || sesion.client !== client || sesion.estado === 'conectado') return;
            try {
                const diagnostico = await client.pupPage?.evaluate(() => {
                    const w = window as unknown as {
                        Debug?: { VERSION?: string };
                        Store?: unknown;
                        WWebJS?: unknown;
                        AuthStore?: { AppState?: { state?: string } };
                    };
                    return {
                        version: w.Debug?.VERSION,
                        store: typeof w.Store,
                        wwebjs: typeof w.WWebJS,
                        appState: w.AuthStore?.AppState?.state,
                    };
                });
                this.logger.error(`⏱️ Sesión ${sessionId} autenticada pero sin 'ready' tras ${timeoutMs / 1000}s: ${JSON.stringify(diagnostico)}`);
            } catch (err) {
                this.logger.error(`⏱️ Sesión ${sessionId} sin 'ready' y no se pudo diagnosticar la página: ${err.message}`);
            }
        }, timeoutMs);
    }

    async conectarNuevaSesion(sessionId: string) {
        this.logger.log(`🔌 Iniciando nueva sesión: ${sessionId}`);
        const client = this.crearCliente(sessionId);

        this.sesiones[sessionId] = { client, estado: 'inicializando' };

        client.on('qr', (qr) => {
            this.logger.log(`📲 QR generado para sesión ${sessionId}`);
            this.sesiones[sessionId].qr = qr;
            this.sesiones[sessionId].estado = 'esperando escaneo';
            this.redis.publish('estado-sesion', JSON.stringify({ estado: 'qr', qr, ani: '', sessionId }));
        });

        client.on('authenticated', async () => {
            this.logger.log(`🔐 Sesión ${sessionId} autenticada`);
            if (this.sesiones[sessionId].estado !== 'iniciando_sesion') {
                this.vigilarReady(sessionId, client);
            }
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
            // updateMany: la sesión solo existe en DB si llegó a 'ready'; update() tiraba P2025 sin capturar
            await this.prisma.sesion.updateMany({ where: { sessionId }, data: { estado: 'desconectado' } });
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
        const client = this.crearCliente(sessionId);

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

        client.on('error', (err) => {
            this.logger.error(`❌ Error en sesión ${sessionId}: ${err}`);
        });

        client.on('change_state', (state) => {
            this.logger.log(`📶 Estado de sesión ${sessionId}: ${state}`);
        });

        client.on('qr', (qr) => {
            this.logger.log(`📸 QR generado para sesión ${sessionId}`);
        });

        client.on('authenticated', () => {
            this.logger.log(`🔐 Sesión ${sessionId} autenticada`);
        });

        try {
            await client.initialize();
        } catch (error) {
            this.logger.error(`❌ Error al inicializar sesión ${sessionId}: ${error}`);
        }

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
        const ruta = getSessionFolder(sessionId);
        if (fs.existsSync(ruta)) {
            await fs.promises.rm(ruta, { recursive: true, force: true });
            this.logger.log(`🗂️ Carpeta de sesión eliminada: ${ruta}`);
        }
    }

    async borrarTodasLasCarpetasSesion() {
        const basePath = getAuthBasePath();
        const archivos = await fs.promises.readdir(basePath);
        const carpetasSesion = archivos.filter(nombre => nombre.startsWith('session-'));
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
            const fecha = msg.timestamp ? new Date(msg.timestamp * 1000) : new Date();
            const tipo = msg.type;
            let campañaId: number | null = null;

            const asignarCampaña = async () => {
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
                            return ultimoEnviado.campañaId;
                        }
                    }
                }
                return null;
            };

            if (msg.hasMedia) {
                const mediaMsg = msg as Message & { caption?: string };
                const media = await msg.downloadMedia();

                let mimetype = media?.mimetype?.toLowerCase() || '';
                const filename = media?.filename ? ` (${media.filename})` : '';

                let mensaje = '📁 Archivo' + filename;

                if (mimetype.startsWith('image/')) {
                    mensaje = `📷 Imagen${filename}`;
                } else if (mimetype.startsWith('video/')) {
                    mensaje = `🎥 Video${filename}`;
                } else if (mimetype.startsWith('audio/')) {
                    mensaje = `🎧 Audio${filename}`;
                } else if (mimetype === 'application/pdf') {
                    mensaje = `📄 Documento PDF${filename}`;
                } else if (mimetype.includes('word')) {
                    mensaje = `📄 Documento Word${filename}`;
                } else if (mimetype.includes('excel')) {
                    mensaje = `📊 Documento Excel${filename}`;
                }

                campañaId = await asignarCampaña();

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

                this.logger.log(`[${fromMe ? 'ENVIADO' : 'RECIBIDO'}] ${numero}: ${mensaje}`);

                // Guardar caption si vino
                if (mediaMsg.caption?.trim()) {
                    await this.prisma.mensaje.create({
                        data: {
                            numero,
                            mensaje: mediaMsg.caption.trim(),
                            fromMe,
                            fecha,
                            tipo: 'texto',
                            ani,
                            campañaId,
                        },
                    });

                    this.logger.log(`[${fromMe ? 'ENVIADO' : 'RECIBIDO'}] ${numero}: ${mediaMsg.caption.trim()}`);
                }
                // 📝 Guardar caption si viene
                const caption = this.obtenerCaption(msg);
                if (caption) {
                    await this.prisma.mensaje.create({
                        data: {
                            numero,
                            mensaje: caption,
                            fromMe,
                            fecha,
                            tipo: 'texto',
                            ani,
                            campañaId,
                        },
                    });

                    this.logger.log(`[${fromMe ? 'ENVIADO' : 'RECIBIDO'}] ${numero}: ${caption}`);
                }
            } else {
                const mensaje = msg.body;
                campañaId = await asignarCampaña();

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

                this.logger.log(`[${fromMe ? 'ENVIADO' : 'RECIBIDO'}] ${numero}: ${mensaje}`);
            }
        } catch (err) {
            this.logger.error(`❌ Error registrando mensaje: ${err.message}`, err.stack);
        }
    }

    private obtenerCaption(msg: Message): string | null {
        return (msg as any)._data?.caption?.trim() || null;
    }
}