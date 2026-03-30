import { Module } from '@nestjs/common';
import { WapiWebhookController } from './wapi-webhook.controller';
import { WapiWebhookService } from './wapi-webhook.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { WapiConfigModule } from '../config/wapi-config.module';
import { WapiInboxModule } from '../inbox/wapi-inbox.module';
import { WapiBajasModule } from '../bajas/wapi-bajas.module';
import { WebsocketModule } from 'src/websocket/websocket.module';

@Module({
  imports: [PrismaModule, WapiConfigModule, WapiInboxModule, WapiBajasModule, WebsocketModule],
  controllers: [WapiWebhookController],
  providers: [WapiWebhookService],
  exports: [WapiWebhookService],
})
export class WapiWebhookModule {}
