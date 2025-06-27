import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { WhatsappWorkerService } from './whatsapp-worker.service';
import { RedisProvider } from './whatsapp-worker.redis';

@Module({
    imports: [PrismaModule],
    providers: [WhatsappWorkerService, RedisProvider],
})
export class WhatsappWorkerModule { }
