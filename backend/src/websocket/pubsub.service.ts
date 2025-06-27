import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { SocketGateway } from './socket.gateway';
import { SesionesService } from 'src/whatsapp/sesiones/sesiones.service';

@Injectable()
export class PubSubService implements OnModuleInit {
    private readonly logger = new Logger(PubSubService.name);
    private redisSub: Redis;
    private redisPub: Redis;

    constructor(private readonly socketGateway: SocketGateway, private readonly sesionesService: SesionesService) {
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
            'solicitar-sesion'
        ];

        for (const canal of canales) {
            await this.redisSub.subscribe(canal);
            this.logger.log(`📡 Subscrito a canal: ${canal}`);
        }

        this.redisSub.on('message', (channel, message) => {
            try {
                const data = JSON.parse(message);

                switch (channel) {
                    case 'solicitar-sesion':
                        this.procesarSolicitudEnvio(data);
                        break;
                    case 'campania-estado':
                        this.socketGateway.emitirEvento('campania_estado', data);
                        break;
                    case 'campania-finalizada':
                        this.socketGateway.emitirEvento('campania_finalizada', data);
                        break;
                    case 'campania-pausada':
                        this.socketGateway.emitirEvento('campania_pausada', data);
                        break;
                    case 'estado-sesion':
                        this.socketGateway.emitirEvento('estado_sesion', data);
                        break;
                    case 'progreso-envio':
                        this.socketGateway.emitirEvento(
                            'progreso',
                            data,
                            `campaña_${data.campañaId}`,
                        );
                        break;
                }
            } catch (err) {
                this.logger.warn(`⚠️ Mensaje mal formado en canal ${channel}`);
            }
        });
    }

    async procesarSolicitudEnvio(data: any) {
        const { sessionId, numero, mensaje, messageId } = data;
        const sesion = this.sesionesService.getSesion(sessionId);

        if (!sesion || sesion.estado !== 'conectado') {
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
                return this.redisPub.publish('respuesta-envio', JSON.stringify({
                    estado: 'fallo',
                    error: 'no registrado en WhatsApp',
                    messageId,
                }));
            }

            await client.sendMessage(jid, mensaje);

            this.redisPub.publish('respuesta-envio', JSON.stringify({
                estado: 'enviado',
                messageId,
            }));
        } catch (err) {
            this.redisPub.publish('respuesta-envio', JSON.stringify({
                estado: 'fallo',
                error: err.message || 'error inesperado',
                messageId,
            }));
        }
    }
}