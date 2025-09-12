// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EmailWorkerService } from 'src/workers/email-worker.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    
    async onModuleInit() {
        // Fuerza la zona horaria -03 en esta sesión del pool
        await this.$executeRawUnsafe('SET time_zone = "-03:00"');
        // (Opcional) Log rápido para verificar
        const [row]: any = await this.$queryRawUnsafe('SELECT @@session.time_zone tz');
        this.logger.log(`Prisma conectado con zona horaria: ${row.tz}`);
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}