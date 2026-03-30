import { Body, Controller, Post } from '@nestjs/common';
import { WapiWebhookService } from '../wapi/webhook/wapi-webhook.service';

interface SimularMensajeDto {
  numero: string;
  nombre?: string;
  texto: string;
}

interface SimularDocumentoDto {
  numero: string;
  nombre?: string;
  caption?: string;
  filename?: string;
}

interface SimularAudioDto {
  numero: string;
  nombre?: string;
}

interface SimularContactoDto {
  numero: string;
  nombre?: string;
  contactoNombre: string;
  contactoTelefono?: string;
  contactoEmpresa?: string;
}

interface SimularReaccionDto {
  numero: string;
  nombre?: string;
  emoji: string;
  waMessageId: string;
}

interface SimularBotonDto {
  numero: string;
  nombre?: string;
  payload: string;
  textoBoton?: string;
}

interface SimularStatusDto {
  waMessageId: string;
  status: 'delivered' | 'read';
  numero: string;
}

function buildPayload(phoneNumberId: string, changes: object) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: 'dev-waba', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: phoneNumberId }, ...changes } }] }],
  };
}

function waId(): string {
  return `wamid.dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function nowTs(): string {
  return Math.floor(Date.now() / 1000).toString();
}

@Controller('dev/simular')
export class DevSimuladorController {
  constructor(private readonly webhookService: WapiWebhookService) {}

  /** Simula un mensaje de texto entrante */
  @Post('mensaje')
  async mensaje(@Body() dto: SimularMensajeDto) {
    const payload = buildPayload('dev-phone-id', {
      contacts: [{ profile: { name: dto.nombre ?? 'Usuario Test' }, wa_id: dto.numero }],
      messages: [{ from: dto.numero, id: waId(), timestamp: nowTs(), type: 'text', text: { body: dto.texto } }],
    });
    await this.webhookService.procesarEvento(payload);
    return { ok: true, simulado: 'mensaje-texto', numero: dto.numero };
  }

  /** Simula que el contacto presiona un botón de template */
  @Post('boton')
  async boton(@Body() dto: SimularBotonDto) {
    const payload = buildPayload('dev-phone-id', {
      contacts: [{ profile: { name: dto.nombre ?? 'Usuario Test' }, wa_id: dto.numero }],
      messages: [{ from: dto.numero, id: waId(), timestamp: nowTs(), type: 'button', button: { payload: dto.payload, text: dto.textoBoton ?? dto.payload } }],
    });
    await this.webhookService.procesarEvento(payload);
    return { ok: true, simulado: 'boton', payload: dto.payload, numero: dto.numero };
  }

  /** Simula un status update (delivered / read) */
  @Post('status')
  async status(@Body() dto: SimularStatusDto) {
    const payload = buildPayload('dev-phone-id', {
      statuses: [{ id: dto.waMessageId, status: dto.status, timestamp: nowTs(), recipient_id: dto.numero }],
    });
    await this.webhookService.procesarEvento(payload);
    return { ok: true, simulado: 'status', status: dto.status, waMessageId: dto.waMessageId };
  }

  /** Simula una imagen entrante (el mediaUrl es un ID falso — no se podrá descargar) */
  @Post('imagen')
  async imagen(@Body() dto: SimularMensajeDto) {
    const payload = buildPayload('dev-phone-id', {
      contacts: [{ profile: { name: dto.nombre ?? 'Usuario Test' }, wa_id: dto.numero }],
      messages: [{
        from: dto.numero, id: waId(), timestamp: nowTs(), type: 'image',
        image: { id: 'dev-media-id', mime_type: 'image/jpeg', caption: dto.texto ?? null },
      }],
    });
    await this.webhookService.procesarEvento(payload);
    return { ok: true, simulado: 'imagen', numero: dto.numero };
  }

  /** Simula un documento entrante */
  @Post('documento')
  async documento(@Body() dto: SimularDocumentoDto) {
    const payload = buildPayload('dev-phone-id', {
      contacts: [{ profile: { name: dto.nombre ?? 'Usuario Test' }, wa_id: dto.numero }],
      messages: [{
        from: dto.numero, id: waId(), timestamp: nowTs(), type: 'document',
        document: {
          id: 'dev-doc-id',
          mime_type: 'application/pdf',
          caption: dto.caption ?? null,
          filename: dto.filename ?? 'documento.pdf',
        },
      }],
    });
    await this.webhookService.procesarEvento(payload);
    return { ok: true, simulado: 'documento', numero: dto.numero };
  }

  /** Simula un audio entrante */
  @Post('audio')
  async audio(@Body() dto: SimularAudioDto) {
    const payload = buildPayload('dev-phone-id', {
      contacts: [{ profile: { name: dto.nombre ?? 'Usuario Test' }, wa_id: dto.numero }],
      messages: [{
        from: dto.numero, id: waId(), timestamp: nowTs(), type: 'audio',
        audio: { id: 'dev-audio-id', mime_type: 'audio/ogg; codecs=opus' },
      }],
    });
    await this.webhookService.procesarEvento(payload);
    return { ok: true, simulado: 'audio', numero: dto.numero };
  }

  /** Simula el envío de un contacto */
  @Post('contacto')
  async contacto(@Body() dto: SimularContactoDto) {
    const payload = buildPayload('dev-phone-id', {
      contacts: [{ profile: { name: dto.nombre ?? 'Usuario Test' }, wa_id: dto.numero }],
      messages: [{
        from: dto.numero, id: waId(), timestamp: nowTs(), type: 'contacts',
        contacts: [{
          name: { formatted_name: dto.contactoNombre, first_name: dto.contactoNombre },
          phones: dto.contactoTelefono ? [{ phone: dto.contactoTelefono, type: 'CELL' }] : [],
          emails: [],
          org: dto.contactoEmpresa ? { company: dto.contactoEmpresa } : undefined,
        }],
      }],
    });
    await this.webhookService.procesarEvento(payload);
    return { ok: true, simulado: 'contacto', numero: dto.numero };
  }

  /** Simula un sticker entrante (WebP — no visualizable en dev) */
  @Post('sticker')
  async sticker(@Body() dto: SimularAudioDto) {
    const payload = buildPayload('dev-phone-id', {
      contacts: [{ profile: { name: dto.nombre ?? 'Usuario Test' }, wa_id: dto.numero }],
      messages: [{
        from: dto.numero, id: waId(), timestamp: nowTs(), type: 'sticker',
        sticker: { id: 'dev-sticker-id', mime_type: 'image/webp', animated: false },
      }],
    });
    await this.webhookService.procesarEvento(payload);
    return { ok: true, simulado: 'sticker', numero: dto.numero };
  }

  /** Simula una reacción emoji a un mensaje */
  @Post('reaccion')
  async reaccion(@Body() dto: SimularReaccionDto) {
    const payload = buildPayload('dev-phone-id', {
      contacts: [{ profile: { name: dto.nombre ?? 'Usuario Test' }, wa_id: dto.numero }],
      messages: [{
        from: dto.numero, id: waId(), timestamp: nowTs(), type: 'reaction',
        reaction: { message_id: dto.waMessageId, emoji: dto.emoji },
      }],
    });
    await this.webhookService.procesarEvento(payload);
    return { ok: true, simulado: 'reaccion', emoji: dto.emoji, numero: dto.numero };
  }
}
