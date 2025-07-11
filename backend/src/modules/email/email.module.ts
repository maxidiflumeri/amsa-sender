import { Module } from '@nestjs/common';
import { SmtpModule } from './smtp/smtp.module';
import { TemplatesEmailModule } from './templates-email/templates-email.module';
import { EnvioEmailModule } from './envio-email/envio-email.module';

@Module({    
    imports: [SmtpModule, TemplatesEmailModule, EnvioEmailModule],
  })

  export class EmailModule {}  