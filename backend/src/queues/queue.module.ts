// src/queues/queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'colaEnvios',
        }),
    ],
    exports: [BullModule],
})
export class QueueModule { }