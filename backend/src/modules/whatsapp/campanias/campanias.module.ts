import { Module } from '@nestjs/common';
import { CampaniasController } from './campanias.controller';
import { CampaniasService } from './campanias.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { QueueModule } from '../../../queues/queue.module';
import { AuthModule } from 'src/auth/auth.module';
import { DeudoresModule } from 'src/modules/deudores/deudores.module';

@Module({
  imports: [PrismaModule, QueueModule, AuthModule, DeudoresModule],
  controllers: [CampaniasController],
  providers: [CampaniasService]
})
export class CampaniasModule {}
