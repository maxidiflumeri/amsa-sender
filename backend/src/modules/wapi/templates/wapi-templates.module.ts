import { Module } from '@nestjs/common';
import { WapiTemplatesController } from './wapi-templates.controller';
import { WapiTemplatesService } from './wapi-templates.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { WapiConfigModule } from '../config/wapi-config.module';

@Module({
  imports: [PrismaModule, AuthModule, WapiConfigModule],
  controllers: [WapiTemplatesController],
  providers: [WapiTemplatesService],
  exports: [WapiTemplatesService],
})
export class WapiTemplatesModule {}
