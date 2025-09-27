import { Module } from '@nestjs/common';
import { TrackOpenController } from './track-open.controller';
import { TrackClickController } from './track-click.controller';
import { TrackingEmailService } from './tracking-email.service';

@Module({
  controllers: [TrackOpenController, TrackClickController],
  providers: [TrackingEmailService],
  exports: [TrackingEmailService],
})
export class TrackingEmailModule {}