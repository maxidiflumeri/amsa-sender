import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WapiConfigService } from '../config/wapi-config.service';
import { ActualizarButtonActionsDto } from './dtos/actualizar-button-actions.dto';

const META_API_VERSION = 'v20.0';
const META_API_BASE = 'https://graph.facebook.com';

@Injectable()
export class WapiTemplatesService {
  private readonly logger = new Logger(WapiTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wapiConfigService: WapiConfigService,
  ) {}

  async listarTemplates(configId?: number) {
    if (configId) {
      const config = await this.wapiConfigService.obtenerConfigCompleta(configId);
      return this.prisma.waApiTemplate.findMany({
        where: { wabaId: config.wabaId },
        orderBy: { metaNombre: 'asc' },
      });
    }
    return this.prisma.waApiTemplate.findMany({
      orderBy: { metaNombre: 'asc' },
    });
  }

  async sincronizarDesideMeta(configId?: number): Promise<{ sincronizados: number; errores: string[] }> {
    this.logger.log('Sincronizando templates desde Meta API...');
    const config = await this.wapiConfigService.obtenerConfigCompleta(configId);
    const { wabaId, token } = config;
    const errores: string[] = [];
    let sincronizados = 0;

    const url = `${META_API_BASE}/${META_API_VERSION}/${wabaId}/message_templates?limit=250`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Error al obtener templates de Meta: ${res.status} ${body}`);
    }

    const json = await res.json() as { data: any[] };
    const templates: any[] = json.data ?? [];

    for (const tpl of templates) {
      try {
        await this.prisma.waApiTemplate.upsert({
          where: { metaNombre_wabaId: { metaNombre: tpl.name, wabaId } },
          update: {
            categoria: tpl.category,
            idioma: tpl.language,
            estado: tpl.status,
            componentes: tpl.components,
            sincronizadoAt: new Date(),
          },
          create: {
            metaNombre: tpl.name,
            wabaId,
            categoria: tpl.category,
            idioma: tpl.language,
            estado: tpl.status,
            componentes: tpl.components,
            sincronizadoAt: new Date(),
          },
        });
        sincronizados++;
      } catch (err) {
        this.logger.error(`Error sincronizando template ${tpl.name}: ${err.message}`);
        errores.push(tpl.name);
      }
    }

    this.logger.log(`Templates sincronizados: ${sincronizados}, errores: ${errores.length}`);
    return { sincronizados, errores };
  }

  async actualizarButtonActions(id: number, dto: ActualizarButtonActionsDto) {
    return this.prisma.waApiTemplate.update({
      where: { id },
      data: { buttonActions: dto.buttonActions as any },
    });
  }

  async obtenerPorId(id: number) {
    return this.prisma.waApiTemplate.findUniqueOrThrow({ where: { id } });
  }
}
