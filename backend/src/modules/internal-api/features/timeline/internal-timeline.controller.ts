import { Controller, Get, Logger, Param, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DeudoresService } from 'src/modules/deudores/deudores.service';
import { InternalApiKeyGuard } from '../../guards/internal-api-key.guard';
import { InternalScope } from '../../decorators/internal-scope.decorator';
import { InternalActor, InternalActorPayload } from '../../decorators/internal-actor.decorator';
import { InternalTimelineQueryDto } from './dtos/internal-timeline-query.dto';

@Controller('internal/timeline')
@UseGuards(InternalApiKeyGuard)
@InternalScope('timeline:read')
export class InternalTimelineController {
    private readonly logger = new Logger(InternalTimelineController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly deudoresService: DeudoresService,
    ) { }

    @Get('por-documento/:documento')
    async porDocumento(
        @Param('documento') documento: string,
        @Query() query: InternalTimelineQueryDto,
        @InternalActor() actor: InternalActorPayload,
    ) {
        const docNormalizado = (documento ?? '').trim();
        const page = query.page ?? 0;
        const size = query.size ?? 30;

        const empty = {
            deudor: null as null | {
                id: number;
                idDeudor: number | null;
                nombre: string | null;
                documento: string | null;
                empresa: string | null;
                nroEmpresa: string | null;
            },
            data: [] as any[],
            total: 0,
            page,
            size,
            totalPages: 0,
        };

        if (!docNormalizado) return empty;

        const deudor = await this.prisma.deudor.findFirst({
            where: { documento: docNormalizado },
            select: {
                id: true,
                idDeudor: true,
                nombre: true,
                documento: true,
                empresa: true,
                nroEmpresa: true,
            },
            orderBy: { id: 'desc' },
        });

        if (!deudor) {
            this.logger.log(`[internal/${actor.keyId}] timeline doc=${docNormalizado} sin match`);
            return empty;
        }

        this.logger.log(`[internal/${actor.keyId}] timeline doc=${docNormalizado} → deudor=${deudor.id}`);

        const res = await this.deudoresService.obtenerTimeline(deudor.id, query as any);
        return { deudor, ...res };
    }
}
