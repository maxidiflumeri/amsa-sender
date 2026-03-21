import { Controller, Get, Inject, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RedisClientType } from 'redis';

@Controller('campania-logs')
@UseGuards(JwtAuthGuard)
export class CampaniaLogsController {
    constructor(
        @Inject('LOGS_REDIS') private readonly redis: RedisClientType,
    ) {}

    @Get(':id')
    async getLogs(
        @Param('id', ParseIntPipe) id: number,
        @Query('tipo') tipo: 'wa' | 'email' | 'wapi' = 'wa',
    ): Promise<any[]> {
        const key = tipo === 'email'
            ? `campania-email-logs:${id}`
            : tipo === 'wapi'
                ? `campania-wapi-logs:${id}`
                : `campania-wa-logs:${id}`;
        const raw = await this.redis.lRange(key, 0, -1);
        return raw.map(r => JSON.parse(r));
    }
}
