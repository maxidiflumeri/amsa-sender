import { Module } from '@nestjs/common';
import { WapiReportesService } from './wapi-reportes.service';
import { WapiReportesController } from './wapi-reportes.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { WapiAnaliticaModule } from '../analitica/wapi-analitica.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, WapiAnaliticaModule, AuthModule],
  controllers: [WapiReportesController],
  providers: [WapiReportesService],
})
export class WapiReportesModule {}
