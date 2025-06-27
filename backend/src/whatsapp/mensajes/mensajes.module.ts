import { Module } from '@nestjs/common';
import { MensajesController } from './mensajes.controller';
import { MensajesService } from './mensajes.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { QueueModule } from '../../queues/queue.module';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [MensajesController],
  providers: [MensajesService]
})
export class MensajesModule {}
