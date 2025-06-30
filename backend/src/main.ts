import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as cors from 'cors';
import * as dotenv from 'dotenv';
import { json } from 'express';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { IoAdapter } from '@nestjs/platform-socket.io';

dotenv.config();

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Middlewares globales
    app.use(cors());
    app.use(json());
    app.useGlobalInterceptors(new LoggingInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api');
    app.useWebSocketAdapter(new IoAdapter(app));

    const port = process.env.PORT || 3001;
    await app.listen(port);

    const logger = new Logger('Bootstrap');
    logger.log(`🚀 Backend corriendo en http://localhost:${port}`);
}

process.on('unhandledRejection', (reason) => {
    console.error('🚨 Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
});

bootstrap();