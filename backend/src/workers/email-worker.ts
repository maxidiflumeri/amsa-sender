// workers/email-worker.ts
import { NestFactory } from '@nestjs/core';
import { EmailWorkerModule } from './email-worker.module';

// Safety net: evitar que el proceso muera por errores no manejados
process.on('uncaughtException', (err) => {
    console.error('🔥 [EmailWorker] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('🔥 [EmailWorker] Unhandled Rejection:', reason);
});

async function bootstrap() {
    await NestFactory.createApplicationContext(EmailWorkerModule);
}
bootstrap();