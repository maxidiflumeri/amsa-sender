import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WapiConfigService } from '../config/wapi-config.service';

export interface RegistrarBajaDto {
  numero: string;
  campañaId?: number;
  campañaNombre?: string;
  templateNombre?: string;
  buttonPayload?: string;
}

const META_API_VERSION = 'v20.0';
const META_API_BASE = 'https://graph.facebook.com';
const MSG_CONFIRMACION_BAJA_DEFAULT = 'Hemos procesado tu solicitud de baja. No recibirás más mensajes nuestros. Si en algún momento querés volver a saber de nosotros, podés escribirnos directamente.';

@Injectable()
export class WapiBajasService {
  private readonly logger = new Logger(WapiBajasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: WapiConfigService,
  ) {}

  async registrarBaja(dto: RegistrarBajaDto): Promise<void> {
    // Upsert: si ya existe, actualizamos fecha. Si no, creamos.
    await this.prisma.waApiBaja.upsert({
      where: { numero: dto.numero },
      update: {
        campañaId: dto.campañaId ?? null,
        campañaNombre: dto.campañaNombre ?? null,
        templateNombre: dto.templateNombre ?? null,
        buttonPayload: dto.buttonPayload ?? null,
        creadoAt: new Date(),
      },
      create: {
        numero: dto.numero,
        campañaId: dto.campañaId ?? null,
        campañaNombre: dto.campañaNombre ?? null,
        templateNombre: dto.templateNombre ?? null,
        buttonPayload: dto.buttonPayload ?? null,
        confirmacionEnviada: false,
      },
    });

    this.logger.log(`Baja registrada para ${dto.numero}`);
    await this.enviarConfirmacion(dto.numero);
  }

  private async enviarConfirmacion(numero: string): Promise<void> {
    try {
      const config = await this.configService.obtenerConfigCompleta();
      const texto = config.msgConfirmacionBaja?.trim() || MSG_CONFIRMACION_BAJA_DEFAULT;
      const url = `${META_API_BASE}/${META_API_VERSION}/${config.phoneNumberId}/messages`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: numero,
          type: 'text',
          text: { body: texto },
        }),
      });

      if (res.ok) {
        await this.prisma.waApiBaja.update({
          where: { numero },
          data: { confirmacionEnviada: true },
        });
        this.logger.log(`Confirmación de baja enviada a ${numero}`);
      } else {
        this.logger.warn(`No se pudo enviar confirmación de baja a ${numero}: ${res.status}`);
      }
    } catch (err) {
      this.logger.error(`Error enviando confirmación de baja a ${numero}: ${err.message}`);
    }
  }

  async listarBajas(page = 1, size = 50, q?: string) {
    const skip = (page - 1) * size;
    const where = q ? { numero: { contains: q } } : {};
    const [items, total] = await Promise.all([
      this.prisma.waApiBaja.findMany({ where, skip, take: size, orderBy: { creadoAt: 'desc' } }),
      this.prisma.waApiBaja.count({ where }),
    ]);
    return { items, total, page, size };
  }

  async estaEnBajas(numero: string): Promise<boolean> {
    const baja = await this.prisma.waApiBaja.findUnique({ where: { numero } });
    return !!baja;
  }

  async eliminarBaja(numero: string) {
    return this.prisma.waApiBaja.delete({ where: { numero } });
  }

  async agregarBajaManual(numero: string) {
    return this.prisma.waApiBaja.upsert({
      where: { numero },
      update: { creadoAt: new Date() },
      create: { numero, buttonPayload: 'manual' },
    });
  }
}
