import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { PrismaService } from 'src/prisma/prisma.service';
import { WapiConfigService } from '../config/wapi-config.service';
import { SocketGateway } from 'src/websocket/socket.gateway';
import { BedrockService } from 'src/modules/ai/bedrock.service';
import { MensajeEntranteDto } from './dtos/mensaje-entrante.dto';

const META_API_VERSION = 'v20.0';
const META_API_BASE = 'https://graph.facebook.com';

@Injectable()
export class WapiInboxService {
  private readonly logger = new Logger(WapiInboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: WapiConfigService,
    private readonly socketGateway: SocketGateway,
    private readonly gemini: BedrockService,
  ) {}

  private readonly MENSAJE_BIENVENIDA_DEFAULT =
    '¡Hola! 👋 Gracias por comunicarte con nosotros. Tu mensaje fue recibido y en breve un asesor estará disponible para ayudarte. ¡Te pedimos aguardes unos momentos!';

  /** Llamado desde WapiWebhookService al recibir un mensaje entrante */
  async procesarMensajeEntrante(dto: MensajeEntranteDto): Promise<void> {
    // Buscar conversación existente para decidir el estado
    const existing = await this.prisma.waApiConversacion.findUnique({
      where: { numero_configId: { numero: dto.numero, configId: dto.configId } },
    });

    const esNueva = !existing;
    const ventanaVencida = existing?.ventana24hAt
      ? Date.now() - new Date(existing.ventana24hAt).getTime() > 24 * 60 * 60 * 1000
      : true;
    const esReabierta = !!existing && (ventanaVencida || existing.estado === 'resuelta');

    // Determinar el nuevo estado
    const nuevoEstado = esNueva ? 'sin_asignar' : (esReabierta ? 'sin_asignar' : existing.estado);

    // Usar upsert para evitar race conditions
    let conv = await this.prisma.waApiConversacion.upsert({
      where: { numero_configId: { numero: dto.numero, configId: dto.configId } },
      create: {
        numero: dto.numero,
        configId: dto.configId,
        nombre: dto.nombre,
        estado: 'sin_asignar',
        ultimoMensajeAt: dto.timestamp,
        ventana24hAt: dto.timestamp,
      },
      update: {
        nombre: dto.nombre ?? undefined,
        ultimoMensajeAt: dto.timestamp,
        ventana24hAt: dto.timestamp,
        estado: nuevoEstado,
      },
    });

    const mensaje = await this.prisma.waApiMensaje.create({
      data: {
        conversacionId: conv.id,
        waMessageId: dto.waMessageId,
        fromMe: false,
        tipo: dto.tipo,
        contenido: dto.contenido,
        timestamp: dto.timestamp,
      },
    });

    // Incrementar contador de no leídos
    conv = await this.prisma.waApiConversacion.update({
      where: { id: conv.id },
      data: { unreadCount: { increment: 1 } },
    });

    // Emitir al inbox en tiempo real
    this.socketGateway.emitirEvento(
      'wapi:nuevo_mensaje',
      {
        conversacion: this.conVentana(conv),
        mensaje: { ...mensaje },
        configId: dto.configId,
      },
      'inbox_wapi',
    );

    this.logger.log(`Mensaje entrante guardado — conv ${conv.id} (${dto.numero})`);

    // Ficha de contacto: misma lógica que bienvenida (nueva, ventana vencida o botón INBOX)
    // NO se muestra si el gestor marcó resuelta y el cliente escribe dentro de las 24hs
    const debeMostrarFicha = esNueva || ventanaVencida || dto.enviarBienvenidaForzada;
    if (debeMostrarFicha) {
      await this.insertarFichaContacto(conv, dto.numero).catch(err =>
        this.logger.warn(`No se pudo generar ficha de contacto para ${dto.numero}: ${err.message}`),
      );
    }

    // Bienvenida: conversación nueva, ventana vencida, o botón INBOX (siempre)
    const debeEnviarBienvenida = esNueva || ventanaVencida || dto.enviarBienvenidaForzada;
    if (debeEnviarBienvenida) {
      await this.enviarBienvenida(conv).catch(err =>
        this.logger.warn(`No se pudo enviar mensaje de bienvenida a ${dto.numero}: ${err.message}`),
      );
    }
  }

  /** Busca el contacto en campañas previas y, si lo encuentra, inserta un mensaje de sistema con su ficha */
  private async insertarFichaContacto(conv: any, numero: string): Promise<void> {
    const contacto = await this.prisma.waApiContacto.findFirst({
      where: { numero },
      orderBy: { id: 'desc' },
      include: {
        campaña: {
          select: { id: true, nombre: true, config: true },
        },
      },
    });

    if (!contacto) return;

    // Mapear variables numéricas a nombres de columna usando variableMapping de la campaña
    const variableMapping: Record<string, string> =
      (contacto.campaña?.config as any)?.variableMapping ?? {};
    const variables = contacto.variables as Record<string, string> | null ?? {};

    const datosNombrados: Record<string, string> = {};
    for (const [idx, valor] of Object.entries(variables)) {
      const nombreColumna = variableMapping[idx] ?? `variable_${idx}`;
      datosNombrados[nombreColumna] = valor;
    }

    const contenido = {
      tipo: 'ficha_contacto',
      nombre: contacto.nombre,
      campañaNombre: contacto.campaña?.nombre ?? null,
      campañaId: contacto.campañaId,
      datos: datosNombrados,
    };

    const msgSistema = await this.prisma.waApiMensaje.create({
      data: {
        conversacionId: conv.id,
        waMessageId: null,
        fromMe: false,
        tipo: 'sistema',
        contenido,
        timestamp: new Date(),
      },
    });

    // Denormalizar campañaNombre en la conversación para el listado
    if (contenido.campañaNombre) {
      const convActualizada = await this.prisma.waApiConversacion.update({
        where: { id: conv.id },
        data: { campañaNombre: contenido.campañaNombre },
        include: { asignadoA: { select: this.INCLUDE_USUARIO } },
      });
      this.socketGateway.emitirEvento(
        'wapi:conversacion_actualizada',
        { ...this.conVentana(convActualizada), configId: conv.configId },
        'inbox_wapi',
      );
    }

    this.socketGateway.emitirEvento(
      'wapi:nuevo_mensaje',
      { conversacion: { id: conv.id, numero: conv.numero }, mensaje: msgSistema, configId: conv.configId },
      'inbox_wapi',
    );

    this.logger.log(`Ficha de contacto insertada para ${numero} (campaña: ${contacto.campaña?.nombre})`);
  }

  private async enviarBienvenida(conv: any): Promise<void> {
    const config = await this.configService.obtenerConfigCompleta(conv.configId);
    const texto = config.msgBienvenida?.trim() || this.MENSAJE_BIENVENIDA_DEFAULT;
    const url = `${META_API_BASE}/${META_API_VERSION}/${config.phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: conv.numero,
        type: 'text',
        text: { body: texto },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Meta API ${res.status}: ${err}`);
    }

    const json = await res.json() as { messages: { id: string }[] };
    const waMessageId = json.messages?.[0]?.id ?? null;

    const mensaje = await this.prisma.waApiMensaje.create({
      data: {
        conversacionId: conv.id,
        waMessageId,
        fromMe: true,
        tipo: 'text',
        contenido: { text: texto },
        timestamp: new Date(),
      },
    });

    await this.prisma.waApiConversacion.update({
      where: { id: conv.id },
      data: { ultimoMensajeAt: new Date() },
    });

    this.socketGateway.emitirEvento(
      'wapi:nuevo_mensaje',
      { conversacion: { id: conv.id, numero: conv.numero }, mensaje, configId: conv.configId },
      'inbox_wapi',
    );

    this.logger.log(`Mensaje de bienvenida enviado a ${conv.numero}`);
  }

  private readonly INCLUDE_USUARIO = { id: true, nombre: true } as const;

  async listarConversaciones(userId: number, esAdmin: boolean, configId?: number) {
    const where = esAdmin
      ? (configId ? { configId } : {})
      : { OR: [{ asignadoAId: userId }, { estado: 'sin_asignar' as const }], ...(configId ? { configId } : {}) };
    const convs = await this.prisma.waApiConversacion.findMany({
      where,
      orderBy: { ultimoMensajeAt: 'desc' },
      include: {
        mensajes: { orderBy: { timestamp: 'desc' }, take: 1 },
        asignadoA: { select: this.INCLUDE_USUARIO },
        config: { select: { id: true, nombre: true } },
      },
    });
    return convs.map(c => this.conVentana(c));
  }

  async listarSinAsignar(configId?: number) {
    const convs = await this.prisma.waApiConversacion.findMany({
      where: { estado: 'sin_asignar', ...(configId ? { configId } : {}) },
      orderBy: { ultimoMensajeAt: 'desc' },
      include: {
        mensajes: { orderBy: { timestamp: 'desc' }, take: 1 },
        asignadoA: { select: this.INCLUDE_USUARIO },
        config: { select: { id: true, nombre: true } },
      },
    });
    return convs.map(c => this.conVentana(c));
  }

  async obtenerConversacion(id: number) {
    const conv = await this.prisma.waApiConversacion.findUniqueOrThrow({
      where: { id },
      include: {
        mensajes: { orderBy: { timestamp: 'asc' } },
        asignadoA: { select: this.INCLUDE_USUARIO },
        config: { select: { id: true, nombre: true } },
      },
    });
    return this.conVentana(conv);
  }

  private conVentana(conv: any) {
    return {
      ...conv,
      ventanaAbierta: conv.ventana24hAt
        ? Date.now() - new Date(conv.ventana24hAt).getTime() < 24 * 60 * 60 * 1000
        : false,
    };
  }

  async asignarConversacion(id: number, asignadoAId: number) {
    const conv = await this.prisma.waApiConversacion.update({
      where: { id },
      data: { asignadoAId, estado: 'asignada' },
      include: {
        asignadoA: { select: this.INCLUDE_USUARIO },
        config: { select: { id: true, nombre: true } },
      },
    });
    const result = this.conVentana(conv);
    this.socketGateway.emitirEvento('wapi:conversacion_actualizada', { ...result, configId: conv.configId }, 'inbox_wapi');
    return result;
  }

  async tomarConversacion(id: number, userId: number) {
    return this.asignarConversacion(id, userId);
  }

  async resolverConversacion(id: number) {
    const conv = await this.prisma.waApiConversacion.update({
      where: { id },
      data: { estado: 'resuelta', resolvedAt: new Date() },
      include: {
        asignadoA: { select: this.INCLUDE_USUARIO },
        config: { select: { id: true, nombre: true } },
      },
    });
    const result = this.conVentana(conv);
    this.socketGateway.emitirEvento('wapi:conversacion_actualizada', { ...result, configId: conv.configId }, 'inbox_wapi');
    return result;
  }

  async marcarLeido(id: number) {
    const conv = await this.prisma.waApiConversacion.update({
      where: { id },
      data: { unreadCount: 0, lastReadAt: new Date() },
      include: {
        asignadoA: { select: this.INCLUDE_USUARIO },
        config: { select: { id: true, nombre: true } },
      },
    });
    const result = this.conVentana(conv);
    this.socketGateway.emitirEvento('wapi:conversacion_actualizada', { ...result, configId: conv.configId }, 'inbox_wapi');
    return result;
  }

  async marcarNoLeido(id: number) {
    const conv = await this.prisma.waApiConversacion.update({
      where: { id },
      data: { unreadCount: 1 },
      include: {
        asignadoA: { select: this.INCLUDE_USUARIO },
        config: { select: { id: true, nombre: true } },
      },
    });
    const result = this.conVentana(conv);
    this.socketGateway.emitirEvento('wapi:conversacion_actualizada', { ...result, configId: conv.configId }, 'inbox_wapi');
    return result;
  }

  async proxyMedia(mediaId: string, res: Response): Promise<void> {
    const config = await this.configService.obtenerConfigCompleta();

    // 1. Obtener URL temporal del media
    const metaRes = await fetch(
      `${META_API_BASE}/${META_API_VERSION}/${mediaId}`,
      { headers: { Authorization: `Bearer ${config.token}` } },
    );
    if (!metaRes.ok) {
      res.status(502).json({ message: 'No se pudo obtener el media de Meta' });
      return;
    }
    const { url, mime_type } = await metaRes.json() as { url: string; mime_type: string };

    // 2. Descargar el archivo y hacer pipe al response
    const fileRes = await fetch(url, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!fileRes.ok) {
      res.status(502).json({ message: 'No se pudo descargar el archivo de Meta' });
      return;
    }

    res.setHeader('Content-Type', mime_type ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    const buffer = await fileRes.arrayBuffer();
    res.end(Buffer.from(buffer));
  }

  async enviarMensaje(conversacionId: number, texto: string) {
    const conv = await this.prisma.waApiConversacion.findUniqueOrThrow({
      where: { id: conversacionId },
    });

    // Verificar ventana de 24hs
    if (!conv.ventana24hAt) {
      throw new Error('Ventana de 24hs no iniciada. El contacto debe escribir primero.');
    }
    const diff = Date.now() - new Date(conv.ventana24hAt).getTime();
    if (diff > 24 * 60 * 60 * 1000) {
      throw new Error('La ventana de 24hs está cerrada. Solo se pueden enviar templates.');
    }

    const config = await this.configService.obtenerConfigCompleta();
    const url = `${META_API_BASE}/${META_API_VERSION}/${config.phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: conv.numero,
        type: 'text',
        text: { body: texto },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Error enviando mensaje: ${res.status} ${err}`);
    }

    const json = await res.json() as { messages: { id: string }[] };
    const waMessageId = json.messages?.[0]?.id ?? null;

    const mensaje = await this.prisma.waApiMensaje.create({
      data: {
        conversacionId,
        waMessageId,
        fromMe: true,
        tipo: 'text',
        contenido: { text: texto },
        timestamp: new Date(),
      },
    });

    // Si es la primera respuesta del asesor, registrar primeraRespuestaAt
    const updateData: any = { ultimoMensajeAt: new Date() };
    if (!conv.primeraRespuestaAt) {
      updateData.primeraRespuestaAt = new Date();
    }

    await this.prisma.waApiConversacion.update({
      where: { id: conversacionId },
      data: updateData,
    });

    // Emitir en tiempo real al inbox
    this.socketGateway.emitirEvento(
      'wapi:nuevo_mensaje',
      { conversacion: { id: conversacionId, numero: conv.numero }, mensaje, configId: conv.configId },
      'inbox_wapi',
    );

    return mensaje;
  }

  async enviarMedia(
    conversacionId: number,
    file: Express.Multer.File,
    caption?: string,
  ) {
    const conv = await this.prisma.waApiConversacion.findUniqueOrThrow({
      where: { id: conversacionId },
    });

    if (!conv.ventana24hAt) throw new BadRequestException('Ventana de 24hs no iniciada.');
    const diff = Date.now() - new Date(conv.ventana24hAt).getTime();
    if (diff > 24 * 60 * 60 * 1000) throw new BadRequestException('Ventana de 24hs cerrada.');

    const config = await this.configService.obtenerConfigCompleta();

    // 1. Subir el archivo a Meta
    const formData = new FormData();
    const fileBuffer = await fs.readFile(file.path);
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: file.mimetype });
    formData.append('file', blob, file.originalname);
    formData.append('messaging_product', 'whatsapp');

    const uploadRes = await fetch(
      `${META_API_BASE}/${META_API_VERSION}/${config.phoneNumberId}/media`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.token}` },
        body: formData,
      },
    );
    await fs.unlink(file.path).catch(() => null);

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Error subiendo media a Meta: ${uploadRes.status} ${err}`);
    }
    const { id: mediaId } = await uploadRes.json() as { id: string };

    // 2. Detectar tipo de mensaje
    const mime = file.mimetype;
    let tipo: string;
    if (mime.startsWith('image/')) tipo = 'image';
    else if (mime.startsWith('audio/')) tipo = 'audio';
    else if (mime.startsWith('video/')) tipo = 'video';
    else tipo = 'document';

    // 3. Enviar el mensaje con el media_id
    const msgBody: any = {
      messaging_product: 'whatsapp',
      to: conv.numero,
      type: tipo,
      [tipo]: { id: mediaId, ...(caption ? { caption } : {}) },
    };

    const sendRes = await fetch(
      `${META_API_BASE}/${META_API_VERSION}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(msgBody),
      },
    );

    if (!sendRes.ok) {
      const err = await sendRes.text();
      throw new Error(`Error enviando media: ${sendRes.status} ${err}`);
    }

    const sendJson = await sendRes.json() as { messages: { id: string }[] };
    const waMessageId = sendJson.messages?.[0]?.id ?? null;

    const mensaje = await this.prisma.waApiMensaje.create({
      data: {
        conversacionId,
        waMessageId,
        fromMe: true,
        tipo,
        contenido: { mediaUrl: mediaId, caption: caption ?? null, mimeType: mime },
        timestamp: new Date(),
      },
    });

    await this.prisma.waApiConversacion.update({
      where: { id: conversacionId },
      data: { ultimoMensajeAt: new Date() },
    });

    this.socketGateway.emitirEvento(
      'wapi:nuevo_mensaje',
      { conversacion: { id: conversacionId, numero: conv.numero }, mensaje, configId: conv.configId },
      'inbox_wapi',
    );

    return mensaje;
  }

  // ── IA: Resumen y Sugerencia ───────────────────────────────────────────────

  private async obtenerConvParaIA(id: number) {
    return this.prisma.waApiConversacion.findUniqueOrThrow({
      where: { id },
      include: { mensajes: { orderBy: { timestamp: 'asc' } } },
    });
  }

  private async obtenerRespuestasRapidasParaIA() {
    const rrs = await this.prisma.waApiRespuestaRapida.findMany({
      where: { activo: true },
      select: { titulo: true, contenido: true, tags: true },
    });
    return rrs.map(r => ({
      titulo: r.titulo,
      contenido: r.contenido,
      tags: (r.tags as string[]) ?? [],
    }));
  }

  async generarResumen(id: number): Promise<{ resumen: string }> {
    const conv = await this.obtenerConvParaIA(id);
    const resumen = await this.gemini.generarResumen(conv.mensajes);
    return { resumen };
  }

  async generarSugerencia(id: number): Promise<{ sugerencia: string }> {
    const [conv, respuestasRapidas] = await Promise.all([
      this.obtenerConvParaIA(id),
      this.obtenerRespuestasRapidasParaIA(),
    ]);
    const sugerencia = await this.gemini.generarSugerencia(conv.mensajes, {
      campañaNombre: conv.campañaNombre,
      respuestasRapidas,
    });
    return { sugerencia };
  }
}

