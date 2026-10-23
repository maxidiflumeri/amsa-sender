import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PushService } from './push.service';
import { DesuscribirPushDto, SuscribirPushDto } from './dtos/push.dto';

/** Solo requiere sesión: cualquier usuario logueado puede recibir notificaciones de sus conversaciones. */
@Controller('push')
@UseGuards(JwtAuthGuard)
// No hay ValidationPipe global en este backend: se aplica acá para que los DTOs validen
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('clave-publica')
  clavePublica() {
    const clave = this.pushService.obtenerClavePublica();
    if (!clave) {
      throw new ServiceUnavailableException('Las notificaciones no están configuradas en el servidor');
    }
    return { clave };
  }

  @Post('suscripciones')
  @HttpCode(204)
  async suscribir(
    @Req() req: { usuario?: { sub: number } },
    @Body() dto: SuscribirPushDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<void> {
    await this.pushService.suscribir(req.usuario!.sub, dto.endpoint, dto.keys, userAgent);
  }

  @Delete('suscripciones')
  @HttpCode(204)
  async desuscribir(@Req() req: { usuario?: { sub: number } }, @Body() dto: DesuscribirPushDto): Promise<void> {
    await this.pushService.desuscribir(req.usuario!.sub, dto.endpoint);
  }
}
