import { NestFactory } from '@nestjs/core';
import { WhatsappWorkerModule } from './whatsapp-worker.module';

async function bootstrap() {
    await NestFactory.createApplicationContext(WhatsappWorkerModule);
}
bootstrap();