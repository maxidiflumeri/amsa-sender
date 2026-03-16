import { Module } from '@nestjs/common';
import { createClient } from 'redis';
import { Logger } from '@nestjs/common';
import { CampaniaLogsController } from './campania-logs.controller';
import { AuthModule } from 'src/auth/auth.module';

const logger = new Logger('LogsRedis');

const LogsRedisProvider = {
    provide: 'LOGS_REDIS',
    useFactory: async () => {
        const client = createClient({
            url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
            socket: {
                reconnectStrategy: (retries) => Math.min(retries * 500, 10000),
            },
        });
        client.on('error', (err) => logger.error(`[LOGS_REDIS] ${err.message}`));
        client.on('ready', () => logger.log('[LOGS_REDIS] Conectado.'));
        await client.connect();
        return client;
    },
};

@Module({
    imports: [AuthModule],
    providers: [LogsRedisProvider],
    controllers: [CampaniaLogsController],
})
export class CampaniaLogsModule {}
