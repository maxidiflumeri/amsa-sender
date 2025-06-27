import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(SocketGateway.name);

    handleConnection(client: Socket) {
        this.logger.log('🔌 Cliente conectado');

        client.on('join_campaña', (campañaId: number) => {
            client.join(`campaña_${campañaId}`);
            this.logger.log(`🧩 Cliente se unió a sala campaña_${campañaId}`);
        });
    }

    handleDisconnect(client: Socket) {
        this.logger.log('❌ Cliente desconectado');
    }

    emitirEvento(evento: string, data: any, sala?: string) {
        this.logger.log(`📤 [SOCKET] Emitiendo '${evento}' con data: ${JSON.stringify(data)}`);
        if (sala) {
            this.server.to(sala).emit(evento, data);
        } else {
            this.server.emit(evento, data);
        }
    }
}  