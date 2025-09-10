import { Module } from '@nestjs/common';
import { CampaniasEmailService } from './campanias-email.service';
import { CampaniasEmailController } from './campanias-email.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [CampaniasEmailService],
  controllers: [CampaniasEmailController],
  exports: [CampaniasEmailService], // opcional si lo vas a usar en otros módulos
})
export class CampaniasEmailModule {}
