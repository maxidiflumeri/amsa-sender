import { Module } from '@nestjs/common';
import { WapiWorkerService } from './wapi-worker.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [WapiWorkerService],
})
export class WapiWorkerModule {}
