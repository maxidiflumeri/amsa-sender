import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { ConfigModule } from '@nestjs/config';
import { SocketGateway } from './websocket/socket.gateway';
import { PubSubService } from './websocket/pubsub.service';
import { SesionesModule } from './modules/whatsapp/sesiones/sesiones.module';

@Module({
  imports: [PrismaModule, WhatsappModule, ConfigModule.forRoot({ isGlobal: true }), SesionesModule],
  controllers: [AppController],
  providers: [AppService, SocketGateway, PubSubService],
})
export class AppModule { }