// src/scheduler/scheduler.module.ts
import { Module } from '@nestjs/common';
import { QueueModule } from 'src/queues/queue.module';
import { SchedulerService } from './sheduler.service';
import { TareasService } from './tarea.service';
import { TareasController } from './tarea.controller';
import { OrphanDetectorService } from './orphan-detector.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [QueueModule, PrismaModule, AuthModule],
  providers: [SchedulerService, TareasService, OrphanDetectorService],
  controllers: [TareasController],
  exports: [SchedulerService],
})

export class SchedulerModule {}