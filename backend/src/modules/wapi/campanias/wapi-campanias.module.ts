import { Module } from '@nestjs/common';
import { WapiCampaniasController } from './wapi-campanias.controller';
import { WapiCampaniasService } from './wapi-campanias.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { QueueModule } from 'src/queues/queue.module';
import { WapiConfigModule } from '../config/wapi-config.module';
import { WapiTemplatesModule } from '../templates/wapi-templates.module';
import { DeudoresModule } from 'src/modules/deudores/deudores.module';

@Module({
  imports: [PrismaModule, AuthModule, QueueModule, WapiConfigModule, WapiTemplatesModule, DeudoresModule],
  controllers: [WapiCampaniasController],
  providers: [WapiCampaniasService],
  exports: [WapiCampaniasService],
})
export class WapiCampaniasModule {}
