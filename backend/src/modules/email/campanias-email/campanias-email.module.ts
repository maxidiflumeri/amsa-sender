import { Module } from '@nestjs/common';
import { CampaniasEmailService } from './campanias-email.service';
import { CampaniasEmailController } from './campanias-email.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { QueueModule } from 'src/queues/queue.module';
import { DeudoresModule } from 'src/modules/deudores/deudores.module';

@Module({
  imports: [PrismaModule, AuthModule, QueueModule, DeudoresModule],
  providers: [CampaniasEmailService],
  controllers: [CampaniasEmailController],
  exports: [CampaniasEmailService],
})
export class CampaniasEmailModule {}
