import { Module } from '@nestjs/common';
import { ReportesModule } from './reportes/reportes.module';
import { MensajesModule } from './mensajes/mensajes.module';
import { TemplatesModule } from './templates/templates.module';
import { CampaniasModule } from './campanias/campanias.module';
import { SesionesModule } from './sesiones/sesiones.module';

@Module({
    imports: [
        ReportesModule,
        MensajesModule,
        TemplatesModule,
        CampaniasModule,
        SesionesModule,
    ],
})
export class WhatsappModule { }