// src/workers/reportes-worker.ts
import { NestFactory } from '@nestjs/core';
import { ReportesWorkerModule } from './reportes-worker.module';

// Safety net: evitar que el proceso muera por errores no manejados
process.on('uncaughtException', (err) => {
    console.error('🔥 [ReportesWorker] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('🔥 [ReportesWorker] Unhandled Rejection:', reason);
});

async function bootstrap() {
  await NestFactory.createApplicationContext(ReportesWorkerModule);
}
bootstrap();