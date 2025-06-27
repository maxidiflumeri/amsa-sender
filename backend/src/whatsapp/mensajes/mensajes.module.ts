import { Module } from '@nestjs/common';
import { MensajesController } from './mensajes.controller';
import { MensajesService } from './mensajes.service';

@Module({
  controllers: [MensajesController],
  providers: [MensajesService]
})
export class MensajesModule {}
