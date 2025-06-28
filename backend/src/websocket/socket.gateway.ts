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
        this.logger.log(`🔌 Cliente conectado: ${client.id}`);

        client.on('join_campaña', (campañaId: number) => {
            const sala = `campaña_${campañaId}`;
            client.join(sala);
            this.logger.log(`🧩 Cliente ${client.id} se unió a sala ${sala}`);
        });
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`❌ Cliente desconectado: ${client.id}`);
    }

    emitirEvento(evento: string, data: any, sala?: string) {
        const logMsg = sala
            ? `📤 [SOCKET] Emitiendo '${evento}' a sala '${sala}' con data: ${JSON.stringify(data)}`
            : `📤 [SOCKET] Emitiendo '${evento}' a todos los clientes con data: ${JSON.stringify(data)}`;

        this.logger.log(logMsg);

        if (sala) {
            this.server.to(sala).emit(evento, data);
        } else {
            this.server.emit(evento, data);
        }
    }
}