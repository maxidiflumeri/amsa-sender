import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SmtpController } from './smtp.controller';
import { SmtpService } from './smtp.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SmtpController],
  providers: [SmtpService]
})
export class SmtpModule {}
