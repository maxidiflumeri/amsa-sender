import { Module } from '@nestjs/common';
import { WapiInboxController } from './wapi-inbox.controller';
import { WapiInboxService } from './wapi-inbox.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { WapiConfigModule } from '../config/wapi-config.module';
import { WebsocketModule } from 'src/websocket/websocket.module';
import { PushModule } from 'src/modules/push/push.module';
import { AiModule } from 'src/modules/ai/ai.module';

@Module({
  imports: [PrismaModule, AuthModule, WapiConfigModule, WebsocketModule, AiModule, PushModule],
  controllers: [WapiInboxController],
  providers: [WapiInboxService],
  exports: [WapiInboxService],
})
export class WapiInboxModule {}
