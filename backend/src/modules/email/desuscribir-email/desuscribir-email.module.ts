import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { EmailDesuscribirService } from './desuscribir-email.service';
import { EmailDesuscribirController } from './desuscribir-email.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [EmailDesuscribirService],
  controllers: [EmailDesuscribirController],
  exports: [EmailDesuscribirService], // opcional si lo vas a usar en otros módulos
})
export class EmailDesuscribirModule {}
