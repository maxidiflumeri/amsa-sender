import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { SocketGateway } from './socket.gateway';
import { SesionesService } from 'src/modules/whatsapp/sesiones/sesiones.service';

@Injectable()
export class PubSubService implements OnModuleInit {
    private readonly logger = new Logger(PubSubService.name);
    private redisSub: Redis;
    private redisPub: Redis;

    constructor(
        private readonly socketGateway: SocketGateway,
        private readonly sesionesService: SesionesService,
    ) {
        this.redisSub = new Redis({
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT || '6379'),
            maxRetriesPerRequest: null,
        });
        this.redisPub = new Redis({
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT || '6379'),
            maxRetriesPerRequest: null,
        });
    }

    async onModuleInit() {
        const canales = [
            'progreso-envio',
            'campania-finalizada',
            'campania-pausada',
            'campania-estado',
            'estado-sesion',
            'solicitar-sesion',
            'progreso-envio-mail',
            'campania-envio-reanudado'
        ];

        for (const canal of canales) {
            await this.redisSub.subscribe(canal);
            this.logger.log(`📡 Subscrito a canal Redis: ${canal}`);
        }

        this.redisSub.on('message', (channel, message) => {
            try {
                const data = JSON.parse(message);

                switch (channel) {
                    case 'solicitar-sesion':
                        this.logger.log(`📨 Solicitud de envío recibida en canal "${channel}"`);
                        this.procesarSolicitudEnvio(data);
                        break;
                    case 'campania-estado':
                        this.logger.log(`🔄 Cambio de estado de campaña: ${JSON.stringify(data)}`);
                        this.socketGateway.emitirEvento('campania_estado', data);
                        break;
                    case 'campania-finalizada':
                        this.logger.log(`🏁 Campaña finalizada: ${JSON.stringify(data)}`);
                        this.socketGateway.emitirEvento('campania_finalizada', data);
                        break;
                    case 'campania-pausada':
                        this.logger.log(`⏸️ Campaña pausada: ${JSON.stringify(data)}`);
                        this.socketGateway.emitirEvento('campania_pausada', data);
                        break;
                    case 'estado-sesion':
                        this.logger.log(`📶 Estado de sesión actualizado: ${JSON.stringify(data)}`);
                        this.socketGateway.emitirEvento('estado_sesion', data);
                        break;
                    case 'progreso-envio':
                        this.logger.log(`📊 Progreso de envío: ${JSON.stringify(data)}`);
                        this.socketGateway.emitirEvento('progreso', data, `campaña_${data.campañaId}`);
                        break;
                    case 'progreso-envio-mail':
                        this.logger.log(`📊 Progreso de envío mail: ${JSON.stringify(data)}`);
                        this.socketGateway.emitirEvento('progreso_mail', data, `campaña_${data.campañaId}`);
                        break;
                    case 'campania-envio-reanudado':
                        this.logger.log(`🔄 Envío reanudado tras desconexión: ${JSON.stringify(data)}`);
                        this.socketGateway.emitirEvento('campania_envio_reanudado', data);
                        break;
                    default:
                        this.logger.warn(`⚠️ Canal no manejado: ${channel}`);
                        break;
                }
            } catch (err) {
                this.logger.warn(`⚠️ Mensaje mal formado en canal "${channel}": ${err.message}`);
            }
        });
    }

    async procesarSolicitudEnvio(data: any) {
        const { sessionId, numero, mensaje, messageId } = data;
        this.logger.log(`📨 Procesando envío: sessionId=${sessionId}, numero=${numero}, messageId=${messageId}`);

        const sesion = this.sesionesService.getSesion(sessionId);

        if (!sesion || sesion.estado !== 'conectado') {
            this.logger.warn(`🚫 Sesión ${sessionId} no conectada o inexistente`);
            return this.redisPub.publish('respuesta-envio', JSON.stringify({
                estado: 'fallo',
                error: 'sesion no conectada',
                messageId,
            }));
        }

        const client = sesion.client;
        const jid = numero + '@c.us';

        try {
            const tieneWhatsapp = await client.isRegisteredUser(jid);

            if (!tieneWhatsapp) {
                this.logger.warn(`⚠️ ${numero} no está registrado en WhatsApp`);
                return this.redisPub.publish('respuesta-envio', JSON.stringify({
                    estado: 'fallo',
                    error: 'no registrado en WhatsApp',
                    messageId,
                }));
            }

            await client.sendMessage(jid, mensaje);

            this.logger.log(`✅ Mensaje enviado a ${numero} desde sesión ${sessionId}`);
            this.redisPub.publish('respuesta-envio', JSON.stringify({
                estado: 'enviado',
                messageId,
            }));
        } catch (err) {
            this.logger.error(`❌ Error al enviar mensaje a ${numero} desde sesión ${sessionId}: ${err.message}`);
            this.redisPub.publish('respuesta-envio', JSON.stringify({
                estado: 'fallo',
                error: err.message || 'error inesperado',
                messageId,
            }));
        }
    }
}