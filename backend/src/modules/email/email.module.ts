import { Module } from '@nestjs/common';
import { SmtpModule } from './smtp/smtp.module';
import { TemplatesEmailModule } from './templates-email/templates-email.module';

@Module({    
    imports: [SmtpModule, TemplatesEmailModule],
  })

  export class EmailModule {}  