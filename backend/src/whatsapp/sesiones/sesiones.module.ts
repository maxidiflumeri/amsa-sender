import { Module } from '@nestjs/common';
import { SesionesController } from './sesiones.controller';
import { SesionesService } from './sesiones.service';

@Module({
  controllers: [SesionesController],
  providers: [SesionesService]
})
export class SesionesModule {}
