// workers/email-worker.ts
import { NestFactory } from '@nestjs/core';
import { EmailWorkerModule } from './email-worker.module';

async function bootstrap() {
    await NestFactory.createApplicationContext(EmailWorkerModule);
}
bootstrap();