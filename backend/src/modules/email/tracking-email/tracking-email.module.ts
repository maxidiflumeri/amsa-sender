import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TrackOpenController } from './track-open.controller';
import { TrackClickController } from './track-click.controller';
import { TrackingEmailService } from './tracking-email.service';

@Module({
  controllers: [TrackOpenController, TrackClickController],
  providers: [TrackingEmailService, PrismaService],
  exports: [TrackingEmailService],
})
export class TrackingEmailModule {}