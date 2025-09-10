import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EnvioEmailService } from './envio-email.service';
import { EnvioEmailController } from './envio-email.controller';
import { AuthModule } from 'src/auth/auth.module';
import { QueueModule } from 'src/queues/queue.module';

@Module({
  imports: [PrismaModule, AuthModule, QueueModule],
  providers: [EnvioEmailService],
  controllers: [EnvioEmailController],
  exports: [EnvioEmailService], // opcional si lo vas a usar en otros módulos
})
export class EnvioEmailModule {}
