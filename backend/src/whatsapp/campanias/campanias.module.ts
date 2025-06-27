import { Module } from '@nestjs/common';
import { CampaniasController } from './campanias.controller';
import { CampaniasService } from './campanias.service';

@Module({
  controllers: [CampaniasController],
  providers: [CampaniasService]
})
export class CampaniasModule {}
