// workers/email-worker.module.ts
import { Module } from '@nestjs/common';
import { EmailWorkerService } from './email-worker.service';
import { EmailRedisProviders } from './email-worker.redis';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [EmailWorkerService, ...EmailRedisProviders],
})
export class EmailWorkerModule { }