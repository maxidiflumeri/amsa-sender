import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { WapiInboxService } from '../inbox/wapi-inbox.service';
import { WapiBajasService } from '../bajas/wapi-bajas.service';
import { SocketGateway } from 'src/websocket/socket.gateway';

type MetaWebhookPayload = any; // tipado completo en Fase 5

@Injectable()
export class WapiWebhookService {
  private readonly logger = new Logger(WapiWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inboxService: WapiInboxService,
    private readonly bajasService: WapiBajasService,
    private readonly socketGateway: SocketGateway,
  ) {}

  async procesarEvento(payload: MetaWebhookPayload): Promise<void> {
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    if (!changes) return;

    // Status updates (sent/delivered/read/failed)
    if (changes.statuses?.length) {
      for (const status of changes.statuses) {
        await this.procesarStatusUpdate(status);
      }
    }

    // Mensajes entrantes
    if (changes.messages?.length) {
      for (const msg of changes.messages) {
        await this.procesarMensajeEntrante(msg, changes.contacts?.[0]);
      }
    }

    // Typing indicator
    if (changes.typing?.length) {
      this.logger.log(`Typing event recibido: ${JSON.stringify(changes.typing)}`);
      for (const t of changes.typing) {
        this.socketGateway.emitirEvento(
          'wapi:typing',
          { numero: t.from, isTyping: true },
          'inbox_wapi',
        );
      }
    } else {
      // Log del payload completo para detectar si Meta usa otro campo
      this.logger.debug(`Webhook sin typing — campos: ${Object.keys(changes).join(', ')}`);
    }
  }

  private async procesarStatusUpdate(status: any): Promise<void> {
    this.logger.log(`Status update: ${status.id} → ${status.status}`);
    const estadoMap: Record<string, string> = {
      sent: 'sent',
      delivered: 'delivered',
      read: 'read',
      failed: 'failed',
    };
    const nuevoEstado = estadoMap[status.status];
    if (!nuevoEstado) return;

    const campoFecha: Record<string, string> = {
      sent: 'enviadoAt',
      delivered: 'entregadoAt',
      read: 'leidoAt',
      failed: 'fallidoAt',
    };

    await Promise.all([
      this.prisma.waApiReporte.updateMany({
        where: { waMessageId: status.id },
        data: {
          estado: nuevoEstado,
          [campoFecha[nuevoEstado]]: new Date(Number(status.timestamp) * 1000),
          ...(status.errors?.[0] ? { error: status.errors[0].message } : {}),
        },
      }),
      this.prisma.waApiMensaje.updateMany({
        where: { waMessageId: status.id },
        data: { status: nuevoEstado },
      }),
    ]);

    // Emitir al inbox para actualizar ticks en tiempo real
    this.socketGateway.emitirEvento(
      'wapi:mensaje_status',
      { waMessageId: status.id, status: nuevoEstado },
      'inbox_wapi',
    );
  }

  private async procesarMensajeEntrante(msg: any, contactMeta: any): Promise<void> {
    this.logger.log(`Mensaje entrante de ${msg.from}: tipo=${msg.type}`);

    const numero = msg.from;
    const nombreContacto = contactMeta?.profile?.name ?? null;

    // Detectar si es respuesta a botón
    if (msg.type === 'button') {
      const payload = msg.button?.payload;
      await this.procesarPayloadBoton(payload, numero, nombreContacto, msg);
      return;
    }

    // Texto libre → deriva a inbox
    await this.inboxService.procesarMensajeEntrante({
      numero,
      nombre: nombreContacto,
      waMessageId: msg.id,
      tipo: msg.type,
      contenido: this.extraerContenido(msg),
      timestamp: new Date(Number(msg.timestamp) * 1000),
    });
  }

  private async procesarPayloadBoton(
    payload: string,
    numero: string,
    nombre: string | null,
    msg: any,
  ): Promise<void> {
    // Si no hay payload configurado, derivamos al inbox por defecto
    if (!payload) {
      this.logger.log(`Botón sin payload de ${numero} → inbox por defecto`);
      await this.inboxService.procesarMensajeEntrante({
        numero,
        nombre,
        waMessageId: msg.id,
        tipo: 'button',
        contenido: { buttonText: msg.button?.text },
        timestamp: new Date(Number(msg.timestamp) * 1000),
        enviarBienvenidaForzada: true,
      });
      return;
    }

    // Buscar la acción configurada para este payload exacto en todos los templates
    let accion: string | null = null;
    const templates = await this.prisma.waApiTemplate.findMany({
      where: { buttonActions: { not: Prisma.JsonNull } },
      select: { buttonActions: true },
    });

    for (const t of templates) {
      if (!Array.isArray(t.buttonActions)) continue;
      const match = (t.buttonActions as Array<{ payload: string; accion: string }>)
        .find(ba => ba.payload === payload);
      if (match) {
        accion = match.accion;
        break;
      }
    }

    // Fallback: inferir por convención si no hay configuración
    if (!accion) {
      const up = payload.toUpperCase();
      if (up.includes('BAJA') || up.includes('UNSUBSCRIBE')) accion = 'BAJA';
      else accion = 'INBOX';
    }

    if (accion === 'BAJA') {
      this.logger.log(`Baja recibida de ${numero} (payload: ${payload})`);
      await this.bajasService.registrarBaja({ numero, buttonPayload: payload });
      return;
    }

    if (accion === 'IGNORAR') {
      this.logger.log(`Botón IGNORAR para ${numero} (payload: ${payload})`);
      return;
    }

    // INBOX (default)
    this.logger.log(`Botón → inbox para ${numero} (payload: ${payload})`);
    await this.inboxService.procesarMensajeEntrante({
      numero,
      nombre,
      waMessageId: msg.id,
      tipo: 'button',
      contenido: { buttonPayload: payload, buttonText: msg.button?.text },
      timestamp: new Date(Number(msg.timestamp) * 1000),
      enviarBienvenidaForzada: true, // siempre bienvenida al presionar "hablar con asesor"
    });
  }

  private extraerContenido(msg: any): Record<string, any> {
    switch (msg.type) {
      case 'text':
        return { text: msg.text?.body };
      case 'image':
        return { mediaUrl: msg.image?.id, caption: msg.image?.caption, mimeType: msg.image?.mime_type };
      case 'document':
        return { mediaUrl: msg.document?.id, caption: msg.document?.caption, mimeType: msg.document?.mime_type };
      case 'audio':
        return { mediaUrl: msg.audio?.id, mimeType: msg.audio?.mime_type };
      default:
        return { raw: msg };
    }
  }
}
