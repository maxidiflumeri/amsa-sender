import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { DeudoresModule } from 'src/modules/deudores/deudores.module';
import { InternalTimelineController } from './internal-timeline.controller';

@Module({
    imports: [PrismaModule, DeudoresModule],
    controllers: [InternalTimelineController],
})
export class InternalTimelineModule { }
