import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from 'src/prisma/prisma.service';
import { PushPayload } from './dtos/push.dto';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private habilitado = false;
  private clavePublica = '';

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    const publica = process.env.VAPID_PUBLIC_KEY?.trim();
    const privada = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.VAPID_SUBJECT?.trim();
    if (!publica || !privada || !subject) {
      this.logger.warn(
        'Push deshabilitado: faltan VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT. Las notificaciones no se van a enviar.',
      );
      return;
    }
    try {
      webpush.setVapidDetails(subject, publica, privada);
      this.clavePublica = publica;
      this.habilitado = true;
      this.logger.log('Push habilitado (VAPID configurado)');
    } catch (error) {
      this.logger.warn(`Push deshabilitado: configuración VAPID inválida (${(error as Error).message})`);
    }
  }

  estaHabilitado(): boolean {
    return this.habilitado;
  }

  obtenerClavePublica(): string | null {
    return this.habilitado ? this.clavePublica : null;
  }

  async suscribir(
    usuarioId: number,
    endpoint: string,
    keys: { p256dh: string; auth: string },
    userAgent?: string,
  ): Promise<void> {
    const ua = userAgent?.slice(0, 255);
    await this.prisma.pushSuscripcion.upsert({
      where: { endpoint },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, usuarioId, userAgent: ua },
      // El mismo navegador puede pasar a otro usuario (cambio de sesión): se reasigna
      update: { p256dh: keys.p256dh, auth: keys.auth, usuarioId, userAgent: ua },
    });
    this.logger.log(`Suscripción push registrada para usuario ${usuarioId}`);
  }

  async desuscribir(usuarioId: number, endpoint: string): Promise<void> {
    const { count } = await this.prisma.pushSuscripcion.deleteMany({ where: { endpoint, usuarioId } });
    this.logger.log(`Suscripción push eliminada para usuario ${usuarioId} (${count})`);
  }

  /** Envía a todas las suscripciones de los usuarios. Nunca tira: loguea y sigue. */
  async enviarAUsuarios(usuarioIds: number[], payload: PushPayload): Promise<void> {
    if (!this.habilitado || usuarioIds.length === 0) return;
    try {
      const suscripciones = await this.prisma.pushSuscripcion.findMany({
        where: { usuarioId: { in: usuarioIds } },
      });
      if (!suscripciones.length) return;

      const cuerpo = JSON.stringify(payload);
      const resultados = await Promise.allSettled(
        suscripciones.map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              cuerpo,
              { TTL: 60 * 60, urgency: 'high' },
            );
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              await this.prisma.pushSuscripcion.deleteMany({ where: { id: s.id } });
              this.logger.log(`Suscripción push ${s.id} caducada (${status}), eliminada`);
              return;
            }
            throw error;
          }
        }),
      );
      const fallidos = resultados.filter((r) => r.status === 'rejected');
      if (fallidos.length) {
        const motivo = (fallidos[0] as PromiseRejectedResult).reason as { statusCode?: number; message?: string };
        this.logger.warn(
          `Push: ${fallidos.length}/${suscripciones.length} envíos fallaron (ej: ${motivo?.statusCode ?? motivo?.message ?? 'desconocido'})`,
        );
      }
    } catch (error) {
      this.logger.warn(`Push: error al enviar notificaciones: ${(error as Error).message}`);
    }
  }

  /**
   * Avisa de un mensaje entrante de WhatsApp API: al asesor asignado, o si la conversación
   * está sin asignar, a todos los usuarios activos con el permiso `wapi.inbox`.
   * Nunca tira ni demora a quien lo llama (se invoca sin await).
   */
  async notificarMensajeWapiEntrante(
    conv: { id: number; numero: string; nombre?: string | null; estado: string; asignadoAId?: number | null },
    mensaje: { tipo: string; contenido: unknown },
  ): Promise<void> {
    if (!this.habilitado) return;
    try {
      if (mensaje.tipo === 'reaction' || mensaje.tipo === 'sistema') return;

      let destinatarios: number[];
      if (conv.asignadoAId && conv.estado !== 'sin_asignar') {
        const u = await this.prisma.usuario.findFirst({
          where: { id: conv.asignadoAId, activo: true },
          select: { id: true },
        });
        // Asignada a alguien que ya no está activo: nadie la iba a ver. Se avisa como si estuviera sin asignar.
        destinatarios = u ? [u.id] : await this.usuariosConPermiso('wapi.inbox');
      } else {
        destinatarios = await this.usuariosConPermiso('wapi.inbox');
      }
      if (!destinatarios.length) return;

      await this.enviarAUsuarios(destinatarios, {
        titulo: conv.nombre?.trim() || conv.numero,
        cuerpo: PushService.resumirMensaje(mensaje.tipo, mensaje.contenido),
        url: `/wapi/inbox?c=${conv.id}`,
        tag: `conv-${conv.id}`,
      });
    } catch (error) {
      this.logger.warn(`Push: no se pudo notificar la conversación ${conv.id}: ${(error as Error).message}`);
    }
  }

  private async usuariosConPermiso(permiso: string): Promise<number[]> {
    const usuarios = await this.prisma.usuario.findMany({
      where: { activo: true, rolObj: { isNot: null } },
      select: { id: true, rolObj: { select: { permisos: true } } },
    });
    return usuarios
      .filter((u) => Array.isArray(u.rolObj?.permisos) && (u.rolObj.permisos as string[]).includes(permiso))
      .map((u) => u.id);
  }

  static resumirMensaje(tipo: string, contenido: unknown): string {
    const c = (contenido ?? {}) as { text?: string; caption?: string; buttonText?: string };
    const recortar = (t: string) => {
      const limpio = t.replace(/\s+/g, ' ').trim();
      return limpio.length > 120 ? `${limpio.slice(0, 117)}...` : limpio;
    };
    switch (tipo) {
      case 'text':
        return c.text?.trim() ? recortar(c.text) : 'Mensaje nuevo';
      case 'button':
        return c.buttonText?.trim() ? recortar(c.buttonText) : 'Mensaje nuevo';
      case 'image':
        return c.caption?.trim() ? recortar(c.caption) : 'Imagen';
      case 'document':
        return 'Archivo adjunto';
      case 'audio':
        return 'Audio';
      case 'video':
        return 'Video';
      case 'sticker':
        return 'Sticker';
      case 'contacts':
        return 'Contacto compartido';
      default:
        return 'Mensaje nuevo';
    }
  }
}
