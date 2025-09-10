import { Module } from '@nestjs/common';
import { TemplatesEmailService } from './templates-email.service';
import { TemplatesEmailController } from './templates-email.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [TemplatesEmailService],
  controllers: [TemplatesEmailController]
})
export class TemplatesEmailModule {}
