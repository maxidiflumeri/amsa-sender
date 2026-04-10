import { Module } from '@nestjs/common';
import { WapiAnaliticaService } from './wapi-analitica.service';
import { WapiAnaliticaController } from './wapi-analitica.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { AiModule } from 'src/modules/ai/ai.module';

@Module({
  imports: [PrismaModule, AuthModule, AiModule],
  controllers: [WapiAnaliticaController],
  providers: [WapiAnaliticaService],
  exports: [WapiAnaliticaService],
})
export class WapiAnaliticaModule {}
