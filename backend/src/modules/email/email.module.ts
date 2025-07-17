import { Module } from '@nestjs/common';
import { SmtpModule } from './smtp/smtp.module';
import { TemplatesEmailModule } from './templates-email/templates-email.module';
import { EnvioEmailModule } from './envio-email/envio-email.module';
import { CampaniasEmailModule } from './campanias-email/campanias-email.module';
import { EmailPublicModule } from './public-email/public-email.module';

@Module({    
    imports: [SmtpModule, TemplatesEmailModule, EnvioEmailModule, CampaniasEmailModule, EmailPublicModule],
  })

  export class EmailModule {}  