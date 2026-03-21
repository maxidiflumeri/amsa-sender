import { Module } from '@nestjs/common';
import { WapiBajasController } from './wapi-bajas.controller';
import { WapiBajasService } from './wapi-bajas.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { WapiConfigModule } from '../config/wapi-config.module';

@Module({
  imports: [PrismaModule, AuthModule, WapiConfigModule],
  controllers: [WapiBajasController],
  providers: [WapiBajasService],
  exports: [WapiBajasService],
})
export class WapiBajasModule {}
