import { Module } from '@nestjs/common';
import { DeudoresController } from './deudores.controller';
import { DeudoresService } from './deudores.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DeudoresController],
  providers: [DeudoresService],
  exports: [DeudoresService],
})
export class DeudoresModule {}
