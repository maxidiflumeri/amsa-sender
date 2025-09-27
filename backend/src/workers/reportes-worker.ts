// src/workers/reportes-worker.ts
import { NestFactory } from '@nestjs/core';
import { ReportesWorkerModule } from './reportes-worker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(ReportesWorkerModule);
}
bootstrap();