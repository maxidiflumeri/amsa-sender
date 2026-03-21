import { Module } from '@nestjs/common';
import { WapiConfigModule } from './config/wapi-config.module';
import { WapiTemplatesModule } from './templates/wapi-templates.module';
import { WapiCampaniasModule } from './campanias/wapi-campanias.module';
import { WapiWebhookModule } from './webhook/wapi-webhook.module';
import { WapiInboxModule } from './inbox/wapi-inbox.module';
import { WapiBajasModule } from './bajas/wapi-bajas.module';
import { WapiAnaliticaModule } from './analitica/wapi-analitica.module';
import { WapiReportesModule } from './reportes/wapi-reportes.module';

@Module({
  imports: [
    WapiConfigModule,
    WapiTemplatesModule,
    WapiCampaniasModule,
    WapiWebhookModule,
    WapiInboxModule,
    WapiBajasModule,
    WapiAnaliticaModule,
    WapiReportesModule,
  ],
})
export class WapiModule {}
