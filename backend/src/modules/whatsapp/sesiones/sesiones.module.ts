import { Module } from '@nestjs/common';
import { SesionesController } from './sesiones.controller';
import { SesionesService } from './sesiones.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SesionesController],
  providers: [SesionesService],
  exports: [SesionesService]
})
export class SesionesModule {}
