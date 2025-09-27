// src/scheduler/scheduler.module.ts
import { Module } from '@nestjs/common';
import { QueueModule } from 'src/queues/queue.module';
import { SchedulerService } from './sheduler.service';
import { TareasService } from './tarea.service';
import { TareasController } from './tarea.controller';

@Module({
  imports: [QueueModule],
  providers: [SchedulerService, TareasService],
  controllers: [TareasController],
  exports: [SchedulerService], // 👈 opcional, por si lo usás en otro módulo
})

export class SchedulerModule {}