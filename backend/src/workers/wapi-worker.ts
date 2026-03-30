import { NestFactory } from '@nestjs/core';
import { WapiWorkerModule } from './wapi-worker.module';

process.on('uncaughtException', (err) => {
    console.error('🔥 [WapiWorker] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('🔥 [WapiWorker] Unhandled Rejection:', reason);
});

async function bootstrap() {
    await NestFactory.createApplicationContext(WapiWorkerModule, {
        logger: ['log', 'warn', 'error', 'debug'],
    });
}
bootstrap();
