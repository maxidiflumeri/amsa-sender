import { Module } from '@nestjs/common';
import { WapiRespuestasRapidasService } from './wapi-respuestas-rapidas.service';
import { WapiRespuestasRapidasController } from './wapi-respuestas-rapidas.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WapiRespuestasRapidasController],
  providers: [WapiRespuestasRapidasService],
})
export class WapiRespuestasRapidasModule {}
