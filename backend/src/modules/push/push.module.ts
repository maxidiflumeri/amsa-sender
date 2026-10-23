import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [AuthModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
