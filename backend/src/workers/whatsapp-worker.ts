import { NestFactory } from '@nestjs/core';
import { WhatsappWorkerModule } from './whatsapp-worker.module';

// Safety net: evitar que el proceso muera por errores no manejados
process.on('uncaughtException', (err) => {
    console.error('🔥 [WhatsappWorker] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('🔥 [WhatsappWorker] Unhandled Rejection:', reason);
});

async function bootstrap() {
    await NestFactory.createApplicationContext(WhatsappWorkerModule);
}
bootstrap();