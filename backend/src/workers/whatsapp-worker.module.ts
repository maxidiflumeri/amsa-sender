import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WhatsappWorkerService } from './whatsapp-worker.service';
import { RedisProviders } from './whatsapp-worker.redis';

@Module({
    imports: [PrismaModule],
    providers: [WhatsappWorkerService, ...RedisProviders],
})
export class WhatsappWorkerModule { }
