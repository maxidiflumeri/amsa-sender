import { Module } from '@nestjs/common';
import { SmtpModule } from './smtp/smtp.module';
import { TemplatesEmailModule } from './templates-email/templates-email.module';
import { EnvioEmailModule } from './envio-email/envio-email.module';
import { CampaniasEmailModule } from './campanias-email/campanias-email.module';
import { EmailPublicModule } from './public-email/public-email.module';
import { TrackingEmailModule } from './tracking-email/tracking-email.module';
import { ReportesEmailModule } from './reportes-email/reportes-email.module';
import { GmailModule } from './gmail/gmail.module';
import { EmailDesuscribirModule } from './desuscribir-email/desuscribir-email.module';

@Module({    
    imports: [
      SmtpModule,
      TemplatesEmailModule,
      EnvioEmailModule,
      CampaniasEmailModule,
      EmailPublicModule,
      TrackingEmailModule,
      ReportesEmailModule,
      GmailModule,
      EmailDesuscribirModule
    ],
  })

  export class EmailModule {}  