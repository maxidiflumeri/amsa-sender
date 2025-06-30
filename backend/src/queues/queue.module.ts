// src/queues/queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { connection } from './bullmq.config';

@Module({
    imports: [
        BullModule.forRoot({ connection }),
        BullModule.registerQueue({
            name: 'colaEnvios',
        }),
    ],
    exports: [BullModule],
})
export class QueueModule { }