import { Module } from '@nestjs/common';
import { SmtpModule } from './smtp/smtp.module';

@Module({    
    imports: [SmtpModule],
  })

  export class EmailModule {}  