import { Module } from '@nestjs/common';
import { WapiConfigController } from './wapi-config.controller';
import { WapiConfigService } from './wapi-config.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WapiConfigController],
  providers: [WapiConfigService],
  exports: [WapiConfigService],
})
export class WapiConfigModule {}
