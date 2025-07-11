import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { json, urlencoded } from 'express';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { IoAdapter } from '@nestjs/platform-socket.io';

dotenv.config();

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Middlewares globales
    app.enableCors({
        origin: [
            'http://localhost:5173',
            'http://localhost:3000', // por si usás React en ese puerto
            'https://amsasender.anamayasa.com',
        ],
        credentials: true,
    });
    app.use(json());
    app.useGlobalInterceptors(new LoggingInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api');
    app.useWebSocketAdapter(new IoAdapter(app));
    // Aumentar el límite del body
    app.use(json({ limit: '20mb' }));
    app.use(urlencoded({ limit: '20mb', extended: true }));

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