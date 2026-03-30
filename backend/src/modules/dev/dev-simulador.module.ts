import { Module } from '@nestjs/common';
import { DevSimuladorController } from './dev-simulador.controller';
import { WapiWebhookModule } from '../wapi/webhook/wapi-webhook.module';

@Module({
  imports: [WapiWebhookModule],
  controllers: [DevSimuladorController],
})
export class DevSimuladorModule {}
