import { Module } from '@nestjs/common';
import { WapiWorkerService } from './wapi-worker.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisProviders } from './whatsapp-worker.redis';

@Module({
  imports: [PrismaModule],
  providers: [WapiWorkerService, ...RedisProviders],
})
export class WapiWorkerModule {}
