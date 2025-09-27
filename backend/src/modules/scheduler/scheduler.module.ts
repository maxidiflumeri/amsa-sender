// src/scheduler/scheduler.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueueModule } from 'src/queues/queue.module';
import { SchedulerService } from './sheduler.service';
import { TareasService } from './tarea.service';
import { TareasController } from './tarea.controller';

@Module({
  imports: [QueueModule],
  providers: [PrismaService, SchedulerService, TareasService],
  controllers: [TareasController],
  exports: [SchedulerService], // 👈 opcional, por si lo usás en otro módulo
})

export class SchedulerModule {}