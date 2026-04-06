import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { connection } from 'src/queues/bullmq.config';
import { RedisClientType } from 'redis';

const META_API_VERSION = 'v20.0';
const META_API_BASE = 'https://graph.facebook.com';

// Códigos de error Meta que requieren backoff — no son fallos definitivos
const META_RATE_LIMIT_CODES = new Set([131056, 130429, 131048]);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(ms) as Promise<void>;
}

@Injectable()
export class WapiWorkerService implements OnModuleInit {
  private readonly logger = new Logger(WapiWorkerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: RedisClientType,
  ) {}

  async onModuleInit() {
    const worker = new Worker('wapiEnvios', this.procesarJob.bind(this), {
      connection,
      concurrency: 1, // una campaña a la vez para respetar rate limits de Meta
    });

    worker.on('failed', async (job, err) => {
      this.logger.error(`Job ${job?.id ?? 'unknown'} falló: ${err.message}`);
      const campañaId = job?.data?.campañaId;
      if (campañaId) {
        await this.prisma.waApiCampaña
          .update({ where: { id: campañaId }, data: { estado: 'error' } })
          .catch(() => null);
      }
    });

    worker.on('error', err => this.logger.error(`Worker error: ${err.message}`));
    this.logger.log('Worker WA API iniciado y escuchando cola "wapiEnvios"');
  }

  private async procesarJob(job: Job) {
    const { campañaId } = job.data as { campañaId: number };
    this.logger.log(`Procesando campaña WA API ${campañaId}`);

    const campaña = await this.prisma.waApiCampaña.findUnique({
      where: { id: campañaId },
      include: { template: true },
    });

    if (!campaña || !campaña.template) {
      throw new Error(`Campaña ${campañaId} o su template no encontrados`);
    }

    const config = campaña.template;
    const wapiConfig = campaña.configId
      ? await this.prisma.waApiConfig.findUnique({ where: { id: campaña.configId } })
      : await this.prisma.waApiConfig.findFirst({ where: { activo: true } });
    if (!wapiConfig) throw new Error('No hay configuración de WhatsApp API guardada');

    const campConfig = (campaña.config as any) ?? {};
    // Delay aleatorio entre min y max — compatibilidad con campaña viejas que usen delayMs
    const delayMinMs: number = campConfig.delayMinMs ?? campConfig.delayMs ?? 30_000;
    const delayMaxMs: number = campConfig.delayMaxMs ?? campConfig.delayMs ?? 60_000;
    // Límite diario viene de la config de la línea, no de la campaña
    const dailyLimit: number = wapiConfig.dailyLimit ?? 200;
    const backoffMs: number = campConfig.backoffMs ?? 60_000;
    const maxErroresConsecutivos: number = campConfig.maxErroresConsecutivos ?? 5;
    const variableMapping: Record<string, string> = campConfig.variableMapping ?? {};
    let erroresConsecutivos = 0;

    // Obtener contactos que aún no tienen reporte (permite reanudar si falla a mitad)
    const contactosConReporte = await this.prisma.waApiReporte.findMany({
      where: { campañaId },
      select: { contactoId: true },
    });
    const yaEnviadosIds = new Set(contactosConReporte.map(r => r.contactoId));

    const contactos = await this.prisma.waApiContacto.findMany({
      where: { campañaId },
    });

    const pendientes = contactos.filter(c => !yaEnviadosIds.has(c.id));
    const total = contactos.length;
    let enviados = contactosConReporte.length;

    this.logger.log(`Campaña ${campañaId}: ${pendientes.length} pendientes de ${total} total`);
    await this.publicarLog(campañaId, 'info', `🚀 Iniciando campaña — ${pendientes.length} pendientes de ${total} total`);

    for (const contacto of pendientes) {
      // Verificar si la campaña fue pausada o forzada a cerrar externamente
      const estadoActual = await this.prisma.waApiCampaña.findUnique({
        where: { id: campañaId },
        select: { pausada: true, estado: true },
      });
      if (estadoActual?.pausada || estadoActual?.estado === 'pausada') {
        this.logger.log(`Campaña ${campañaId} pausada. Deteniendo worker.`);
        await this.publicarLog(campañaId, 'warn', `⏸️ Campaña pausada. Procesados hasta ahora: ${enviados}/${total}`);
        break;
      }
      if (estadoActual?.estado === 'finalizada' || estadoActual?.estado === 'error') {
        this.logger.warn(`Campaña ${campañaId} detenida externamente (estado: ${estadoActual.estado}). Abortando worker.`);
        await this.publicarLog(campañaId, 'warn', `🛑 Campaña detenida externamente — procesados hasta el corte: ${enviados}/${total}`);
        return;
      }

      // Verificar límite diario de envíos (ventana calendario, 00:00 del día actual)
      if (dailyLimit > 0) {
        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);
        const enviadosHoy = await this.prisma.waApiReporte.count({
          where: {
            estado: 'sent',
            enviadoAt: { gte: inicioDia },
            campaña: { configId: wapiConfig.id },
          },
        });
        if (enviadosHoy >= dailyLimit) {
          await this.prisma.waApiCampaña.update({
            where: { id: campañaId },
            data: { estado: 'pausada', pausada: true },
          });
          await this.publicarLog(
            campañaId, 'warn',
            `⏸️ Límite diario de ${dailyLimit} mensajes alcanzado (${enviadosHoy} enviados hoy). Reanudá la campaña mañana.`,
          );
          this.logger.warn(`Campaña ${campañaId} pausada: límite diario ${dailyLimit} alcanzado (${enviadosHoy} enviados hoy)`);
          return;
        }
      }

      // Verificar supresión en tiempo real
      const enBajas = await this.prisma.waApiBaja.findUnique({ where: { numero: contacto.numero } });
      if (enBajas) {
        await this.prisma.waApiReporte.create({
          data: {
            campañaId,
            contactoId: contacto.id,
            numero: contacto.numero,
            estado: 'failed',
            error: 'Número en lista de bajas',
            creadoAt: new Date(),
          },
        });
        enviados++;
        await this.publicarLog(campañaId, 'skip', `⛔ ${contacto.numero} — en lista de bajas, omitido`);
        await this.safePublish('progreso-envio', JSON.stringify({ campañaId, enviados, total }));
        continue;
      }

      // Construir componentes del template
      const componentes = this.construirComponentes(
        config.componentes as any[],
        config.buttonActions as any[] ?? [],
        (contacto.variables as Record<string, string>) ?? {},
        variableMapping,
      );

      let waMessageId: string | null = null;
      let estado: string = 'failed';
      let error: string | null = null;

      try {
        const url = `${META_API_BASE}/${META_API_VERSION}/${wapiConfig.phoneNumberId}/messages`;
        const body = {
          messaging_product: 'whatsapp',
          to: contacto.numero,
          type: 'template',
          template: {
            name: config.metaNombre,
            language: { code: config.idioma },
            components: componentes,
          },
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${wapiConfig.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const json = await res.json() as any;

        if (res.ok && json.messages?.[0]?.id) {
          waMessageId = json.messages[0].id;
          estado = 'sent';
          erroresConsecutivos = 0;
        } else {
          const metaCode: number | undefined = json.error?.code;
          error = json.error?.message ?? `HTTP ${res.status}`;

          if (metaCode && META_RATE_LIMIT_CODES.has(metaCode)) {
            // Rate limit de Meta — backoff y reintentar este mismo contacto
            erroresConsecutivos++;
            this.logger.warn(`Rate limit Meta (${metaCode}) en ${contacto.numero} — backoff ${backoffMs}ms [errores consecutivos: ${erroresConsecutivos}]`);
            await this.publicarLog(campañaId, 'warn', `⏳ Rate limit Meta (${metaCode}) — esperando ${backoffMs / 1000}s antes de reintentar`);
            await sleep(backoffMs);

            // Verificar si hay que auto-pausar antes del reintento
            if (erroresConsecutivos >= maxErroresConsecutivos) {
              await this.prisma.waApiCampaña.update({ where: { id: campañaId }, data: { estado: 'pausada', pausada: true } });
              await this.publicarLog(campañaId, 'error', `🛑 Campaña auto-pausada: ${erroresConsecutivos} errores de rate limit consecutivos`);
              this.logger.error(`Campaña ${campañaId} auto-pausada por rate limit acumulado`);
              return;
            }

            // Reintento único del mismo contacto
            try {
              const url = `${META_API_BASE}/${META_API_VERSION}/${wapiConfig.phoneNumberId}/messages`;
              const retryRes = await fetch(url, {
                method: 'POST',
                headers: { Authorization: `Bearer ${wapiConfig.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: contacto.numero,
                  type: 'template',
                  template: {
                    name: config.metaNombre,
                    language: { code: config.idioma },
                    components: this.construirComponentes(
                      config.componentes as any[],
                      config.buttonActions as any[] ?? [],
                      (contacto.variables as Record<string, string>) ?? {},
                      variableMapping,
                    ),
                  },
                }),
              });
              const retryJson = await retryRes.json() as any;
              if (retryRes.ok && retryJson.messages?.[0]?.id) {
                waMessageId = retryJson.messages[0].id;
                estado = 'sent';
                erroresConsecutivos = 0;
                error = null;
              } else {
                error = `[retry] ${retryJson.error?.message ?? `HTTP ${retryRes.status}`}`;
              }
            } catch (retryErr) {
              error = `[retry] ${retryErr.message}`;
            }
          } else {
            this.logger.warn(`Error enviando a ${contacto.numero}: ${error}`);
          }
        }
      } catch (err) {
        error = err.message;
        this.logger.error(`Error en fetch para ${contacto.numero}: ${err.message}`);
      }

      await this.prisma.waApiReporte.create({
        data: {
          campañaId,
          contactoId: contacto.id,
          numero: contacto.numero,
          waMessageId,
          estado,
          error,
          enviadoAt: estado === 'sent' ? new Date() : null,
          creadoAt: new Date(),
        },
      });

      enviados++;

      if (estado === 'sent') {
        await this.publicarLog(campañaId, 'ok', `✅ ${contacto.numero} — enviado (${enviados}/${total})`);
      } else {
        await this.publicarLog(campañaId, 'error', `❌ ${contacto.numero} — error: ${error}`);
      }
      await this.safePublish('progreso-envio', JSON.stringify({ campañaId, enviados, total }));

      await randomDelay(delayMinMs, delayMaxMs);
    }

    // Finalizar campaña
    await this.prisma.waApiCampaña.update({
      where: { id: campañaId },
      data: { estado: 'finalizada' },
    });

    await this.publicarLog(campañaId, 'info', `🏁 Finalizada — ${enviados}/${total} procesados`);
    await this.safePublish('campania-finalizada', JSON.stringify({ campañaId }));
    await this.safePublish('campania-estado', JSON.stringify({ campañaId, estado: 'finalizada' }));

    this.logger.log(`Campaña ${campañaId} finalizada. ${enviados}/${total} procesados.`);
  }

  private async publicarLog(campañaId: number, nivel: 'ok' | 'warn' | 'error' | 'info' | 'skip', mensaje: string): Promise<void> {
    const payload = JSON.stringify({ campañaId, nivel, mensaje, timestamp: new Date().toISOString() });
    await this.safePublish('campania-log', payload);
    try {
      const key = `campania-wapi-logs:${campañaId}`;
      await this.redis.rPush(key, payload);
      await this.redis.lTrim(key, -500, -1);
      await this.redis.expire(key, 86400);
    } catch { /* no interrumpir el envío por error de persistencia */ }
  }

  private async safePublish(channel: string, message: string): Promise<void> {
    try {
      await this.redis.publish(channel, message);
    } catch (err) {
      this.logger.error(`❌ Error publicando en "${channel}": ${err.message}`);
    }
  }

  /**
   * Construye el array de componentes para la API de Meta.
   * - Body parameters: mapeados desde variables del contacto
   * - Buttons Quick Reply: payload definido en buttonActions por índice
   */
  private construirComponentes(
    templateComponents: any[],
    buttonActions: any[],
    contactoVariables: Record<string, string>,
    variableMapping: Record<string, string>,
  ): any[] {
    const resultado: any[] = [];

    const bodyComp = templateComponents?.find(c => c.type === 'BODY');
    if (bodyComp) {
      const matches = (bodyComp.text ?? '').match(/\{\{(\d+)\}\}/g) ?? [];
      const variableCount = matches.length;

      if (variableCount > 0) {
        const parameters = Array.from({ length: variableCount }, (_, i) => {
          const idx = String(i + 1);
          const columna = variableMapping[idx];
          const valor = columna ? (contactoVariables[columna] ?? '') : '';
          return { type: 'text', text: valor };
        });
        resultado.push({ type: 'body', parameters });
      }
    }

    // Botones Quick Reply
    if (Array.isArray(buttonActions)) {
      for (const accion of buttonActions) {
        const rawPayload = accion.payload ?? `BTN_${accion.indice}`;
        // Resolver placeholders en el payload:
        // {{N}}       → variable del template vía mapping (ej: {{1}})
        // {{columna}} → columna directa del CSV (ej: {{nro_cliente}})
        const payload = rawPayload.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => {
          if (/^\d+$/.test(key)) {
            const columna = variableMapping[key];
            return columna ? (contactoVariables[columna] ?? '') : '';
          }
          return contactoVariables[key] ?? '';
        });
        resultado.push({
          type: 'button',
          sub_type: 'quick_reply',
          index: String(accion.indice),
          parameters: [{ type: 'payload', payload }],
        });
      }
    }

    return resultado;
  }
}
