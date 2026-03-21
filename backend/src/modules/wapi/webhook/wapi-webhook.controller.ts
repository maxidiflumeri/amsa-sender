import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { WapiWebhookService } from './wapi-webhook.service';
import { WapiConfigService } from '../config/wapi-config.service';
import * as crypto from 'crypto';

@Controller('wapi/webhook')
export class WapiWebhookController {
  private readonly logger = new Logger(WapiWebhookController.name);

  constructor(
    private readonly webhookService: WapiWebhookService,
    private readonly configService: WapiConfigService,
  ) {}

  /** Meta verifica el webhook con un GET al registrarlo en el panel */
  @Get()
  async verificar(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const config = await this.configService.obtenerConfigCompleta();
    if (mode === 'subscribe' && token === config.verifyToken) {
      this.logger.log('Webhook de Meta verificado correctamente');
      return parseInt(challenge, 10);
    }
    this.logger.warn('Verificación de webhook fallida: token incorrecto');
    throw new ForbiddenException('Token de verificación inválido');
  }

  /** Receptor de eventos de Meta (mensajes entrantes + status updates) */
  @Post()
  @HttpCode(200)
  async recibirEvento(
    @Body() payload: any,
    @Req() req: RawBodyRequest<Request>,
  ) {
    // Verificar firma HMAC-SHA256 si está configurado el appSecret
    try {
      const config = await this.configService.obtenerConfigCompleta();
      if (config.appSecret) {
        const signature = (req.headers as any)['x-hub-signature-256'] as string;
        this.verificarFirma(req.rawBody, config.appSecret, signature);
      }
    } catch {
      // Si no hay config todavía, no bloqueamos (durante setup inicial)
    }

    await this.webhookService.procesarEvento(payload);
    return { status: 'ok' };
  }

  private verificarFirma(rawBody: Buffer | undefined, appSecret: string, signature: string): void {
    if (!rawBody || !signature) return;
    const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      this.logger.warn('Firma de webhook inválida');
      throw new ForbiddenException('Firma inválida');
    }
  }
}
