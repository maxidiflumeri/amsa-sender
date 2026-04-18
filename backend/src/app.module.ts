import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { ConfigModule } from '@nestjs/config';
import { SocketGateway } from './websocket/socket.gateway';
import { PubSubService } from './websocket/pubsub.service';
import { WebsocketModule } from './websocket/websocket.module';
import { SesionesModule } from './modules/whatsapp/sesiones/sesiones.module';
import { QueueModule } from './queues/queue.module';
import { AuthModule } from './auth/auth.module';  
import { EmailModule } from './modules/email/email.module';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { CampaniaLogsModule } from './modules/campania-logs/campania-logs.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { WapiModule } from './modules/wapi/wapi.module';
import { WapiWorkerModule } from './workers/wapi-worker.module';
import { DevSimuladorModule } from './modules/dev/dev-simulador.module';
import { DeudoresModule } from './modules/deudores/deudores.module';

const devModules = process.env.NODE_ENV !== 'production' ? [DevSimuladorModule] : [];

@Module({
  imports: [PrismaModule, WhatsappModule, ConfigModule.forRoot({ isGlobal: true }), SesionesModule, QueueModule, AuthModule, EmailModule, ConfiguracionModule, SchedulerModule, CampaniaLogsModule, RolesModule, UsuariosModule, WapiModule, WapiWorkerModule, WebsocketModule, DeudoresModule, ...devModules],
  controllers: [AppController],
  providers: [AppService, PubSubService],
})
export class AppModule { }