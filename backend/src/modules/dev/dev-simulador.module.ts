import { Module } from '@nestjs/common';
import { DevSimuladorController } from './dev-simulador.controller';
import { WapiWebhookModule } from '../wapi/webhook/wapi-webhook.module';
import { WapiConfigModule } from '../wapi/config/wapi-config.module';

@Module({
  imports: [WapiWebhookModule, WapiConfigModule],
  controllers: [DevSimuladorController],
})
export class DevSimuladorModule {}
