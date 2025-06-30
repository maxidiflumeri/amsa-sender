import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SmtpController } from './smtp.controller';
import { SmtpService } from './smtp.service';

@Module({
  imports: [PrismaModule],
  controllers: [SmtpController],
  providers: [SmtpService]
})
export class SmtpModule {}
