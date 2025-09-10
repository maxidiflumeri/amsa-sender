// workers/email-worker.module.ts
import { Module } from '@nestjs/common';
import { EmailWorkerService } from './email-worker.service';
import { EmailRedisProviders } from './email-worker.redis';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmailDesuscribirModule } from 'src/modules/email/desuscribir-email/desuscribir-email.module';

@Module({
    imports: [PrismaModule, EmailDesuscribirModule],
    providers: [EmailWorkerService, ...EmailRedisProviders],
})
export class EmailWorkerModule { }