import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Deudor, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { BuscarDeudoresDto } from './dto/buscar-deudores.dto';
import { TimelineQueryDto } from './dto/timeline-query.dto';
import { ReporteQueryDto } from './dto/reporte-query.dto';
import { ExportarReporteDto } from './dto/exportar-reporte.dto';
import { ExportarDetalleDto } from './dto/exportar-detalle.dto';
import {
  DeudorListItem,
  PaginatedResponse,
  DeudorFicha,
  TimelineEntry,
  ReporteEmpresa,
  ReporteRemesa,
} from './interfaces/timeline.interface';
import { getNombreEmpresa, isEmpresaMapeada } from './constants/empresas.constants';

export interface EmpresaOption {
  id: string;
  nombre: string;
}

@Injectable()
export class DeudoresService {
  private readonly logger = new Logger(DeudoresService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Buscar deudores con filtros + paginación
   */
  async buscar(
    filtros: BuscarDeudoresDto,
  ): Promise<PaginatedResponse<DeudorListItem>> {
    const { q, empresas, nroEmpresa, remesas } = filtros;
    const page = filtros.page ?? 0;
    const size = Math.min(filtros.size ?? 20, 100);

    // Construir where dinámico
    const where: Prisma.DeudorWhereInput = {};

    // Filtro de búsqueda general (q)
    if (q && q.trim() !== '') {
      const trimmedQ = q.trim();
      const orConditions: Prisma.DeudorWhereInput[] = [];

      // Si q es un número entero positivo, buscar por idDeudor
      const parsedId = parseInt(trimmedQ, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        orConditions.push({ idDeudor: parsedId });
      }

      // Siempre agregar búsqueda por texto
      orConditions.push({ nombre: { contains: trimmedQ } });
      orConditions.push({ documento: { contains: trimmedQ } });
      orConditions.push({ nroEmpresa: { contains: trimmedQ } });

      where.OR = orConditions;
    }

    // Filtros específicos
    if (empresas && empresas.length > 0) {
      where.empresa = empresas.length === 1 ? empresas[0] : { in: empresas };
    }
    if (nroEmpresa && nroEmpresa.trim() !== '') {
      where.nroEmpresa = nroEmpresa;
    }
    if (remesas && remesas.length > 0) {
      where.remesa = remesas.length === 1 ? remesas[0] : { in: remesas };
    }

    this.logger.log(
      `Buscando deudores: q=${q || ''}, empresas=${(empresas || []).join('|') || 'todas'}, nroEmpresa=${nroEmpresa || ''}, remesas=${(remesas || []).join('|') || 'todas'}, page=${page}, size=${size}`,
    );

    try {
      const [deudores, total] = await Promise.all([
        this.prisma.deudor.findMany({
          where,
          include: {
            _count: {
              select: {
                contactosWhatsapp: true,
                contactosEmail: true,
                contactosWapi: true,
              },
            },
          },
          orderBy: { id: 'desc' },
          skip: page * size,
          take: size,
        }),
        this.prisma.deudor.count({ where }),
      ]);

      // Mapear a DeudorListItem
      const data: DeudorListItem[] = deudores.map((d) => ({
        id: d.id,
        idDeudor: d.idDeudor,
        nombre: d.nombre,
        documento: d.documento,
        empresa: d.empresa,
        nroEmpresa: d.nroEmpresa,
        remesa: d.remesa,
        canales: {
          whatsapp: d._count.contactosWhatsapp,
          email: d._count.contactosEmail,
          wapi: d._count.contactosWapi,
        },
      }));

      const totalPages = Math.ceil(total / size);

      this.logger.log(`Encontrados ${total} deudores, página ${page + 1}/${totalPages}`);

      return { data, total, page, size, totalPages };
    } catch (error) {
      this.logger.error(
        `Error al buscar deudores: ${error.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException('Error al buscar deudores');
    }
  }

  /**
   * Obtener lista de empresas únicas (ordenadas por nombre legible).
   * Devuelve objetos `{ id, nombre }` donde `id` es el ID VFP y `nombre` se resuelve
   * contra `EMPRESAS_MAP`. Si un ID no está mapeado, el nombre cae al propio ID.
   */
  async obtenerEmpresas(): Promise<EmpresaOption[]> {
    this.logger.log('Obteniendo lista de empresas');

    try {
      const result = await this.prisma.deudor.findMany({
        where: { empresa: { not: null } },
        select: { empresa: true },
        distinct: ['empresa'],
      });

      const empresas: EmpresaOption[] = result
        .map((r) => r.empresa)
        .filter((e): e is string => e !== null)
        .filter((id) => isEmpresaMapeada(id))
        .map((id) => ({ id, nombre: getNombreEmpresa(id) }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

      this.logger.log(`Encontradas ${empresas.length} empresas únicas`);
      return empresas;
    } catch (error) {
      this.logger.error(
        `Error al obtener empresas: ${error.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException('Error al obtener empresas');
    }
  }

  /**
   * Obtener IDs de empresa presentes en la tabla `Deudor` que NO están mapeados
   * en `EMPRESAS_MAP`. Útil para detectar empresas nuevas del sistema VFP que
   * deben agregarse a `empresas.constants.ts`.
   */
  async obtenerEmpresasNoMapeadas(): Promise<Array<{ id: string; cantidadDeudores: number }>> {
    this.logger.log('Obteniendo empresas no mapeadas');

    try {
      const result = await this.prisma.deudor.groupBy({
        by: ['empresa'],
        where: { empresa: { not: null } },
        _count: { _all: true },
      });

      const noMapeadas = result
        .map((r) => ({
          id: r.empresa as string,
          cantidadDeudores: r._count._all,
        }))
        .filter((r) => !isEmpresaMapeada(r.id))
        .sort((a, b) => b.cantidadDeudores - a.cantidadDeudores);

      this.logger.log(`Encontradas ${noMapeadas.length} empresas sin mapear`);
      return noMapeadas;
    } catch (error) {
      this.logger.error(
        `Error al obtener empresas no mapeadas: ${error.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException('Error al obtener empresas no mapeadas');
    }
  }

  /**
   * Obtener lista de remesas únicas (opcionalmente filtradas por una o varias empresas)
   */
  async obtenerRemesas(empresas?: string[]): Promise<string[]> {
    this.logger.log(
      `Obteniendo lista de remesas${empresas && empresas.length > 0 ? ` para empresas=${empresas.join('|')}` : ''}`,
    );

    try {
      const where: Prisma.DeudorWhereInput = { remesa: { not: null } };
      if (empresas && empresas.length > 0) {
        where.empresa = empresas.length === 1 ? empresas[0] : { in: empresas };
      }

      const result = await this.prisma.deudor.findMany({
        where,
        select: { remesa: true },
        distinct: ['remesa'],
        orderBy: { remesa: 'asc' },
      });

      const remesas = result
        .map((r) => r.remesa)
        .filter((r): r is string => r !== null);

      this.logger.log(`Encontradas ${remesas.length} remesas únicas`);
      return remesas;
    } catch (error) {
      this.logger.error(
        `Error al obtener remesas: ${error.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException('Error al obtener remesas');
    }
  }

  /**
   * Obtener ficha individual de un deudor por ID
   */
  async obtenerPorId(id: number): Promise<DeudorFicha> {
    // Validar id
    if (!id || id <= 0 || !Number.isInteger(id)) {
      throw new BadRequestException('El ID del deudor debe ser un entero positivo');
    }

    this.logger.log(`Obteniendo ficha del deudor id=${id}`);

    try {
      // Ejecutar las 4 queries en paralelo
      const [deudor, contactosWhatsapp, contactosWapi, contactosEmail] =
        await Promise.all([
          // 1. Datos master del deudor
          this.prisma.deudor.findUnique({
            where: { id },
          }),

          // 2. Teléfonos de WhatsApp legacy
          this.prisma.contacto.findMany({
            where: { deudorId: id },
            select: { numero: true },
            distinct: ['numero'],
          }),

          // 3. Teléfonos de WAPI
          this.prisma.waApiContacto.findMany({
            where: { deudorId: id },
            select: { numero: true },
            distinct: ['numero'],
          }),

          // 4. Emails
          this.prisma.contactoEmail.findMany({
            where: { deudorId: id },
            select: { email: true },
            distinct: ['email'],
          }),
        ]);

      // Validar existencia
      if (!deudor) {
        throw new NotFoundException(`Deudor con id=${id} no encontrado`);
      }

      // Mergear teléfonos de WA legacy + WAPI (sin duplicados)
      const telefonosSet = new Set<string>();
      contactosWhatsapp.forEach((c) => {
        if (c.numero) telefonosSet.add(c.numero);
      });
      contactosWapi.forEach((c) => {
        if (c.numero) telefonosSet.add(c.numero);
      });
      const telefonos = Array.from(telefonosSet).sort();

      // Normalizar y deduplicar emails (trim + lowercase)
      const emailsSet = new Set<string>();
      contactosEmail.forEach((c) => {
        if (c.email) {
          const normalized = c.email.trim().toLowerCase();
          if (normalized) emailsSet.add(normalized);
        }
      });
      const emails = Array.from(emailsSet).sort();

      const ficha: DeudorFicha = {
        id: deudor.id,
        idDeudor: deudor.idDeudor,
        nombre: deudor.nombre,
        documento: deudor.documento,
        empresa: deudor.empresa,
        nroEmpresa: deudor.nroEmpresa,
        remesa: deudor.remesa,
        datos: deudor.datos as Record<string, unknown> | null,
        creadoEn: deudor.creadoEn,
        actualizadoEn: deudor.actualizadoEn,
        canales: {
          telefonos,
          emails,
        },
      };

      this.logger.log(
        `Ficha deudor id=${id} obtenida: ${telefonos.length} teléfonos, ${emails.length} emails`,
      );

      return ficha;
    } catch (error) {
      // Re-lanzar excepciones de negocio
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Errores inesperados
      this.logger.error(
        `Error al obtener ficha del deudor id=${id}: ${error.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        'Error al obtener la ficha del deudor',
      );
    }
  }

  /**
   * Upsert de Deudor desde import CSV/Excel.
   * - Case-insensitive para todas las keys del rawRow
   * - No pisa con null/undefined campos existentes en update
   * - Hace deep-merge del JSON datos
   * - Retorna null si no hay idDeudor (contactos legacy sin deudor)
   */
  async upsertDesdeImport(
    rawRow: Record<string, any>,
    opciones?: { aliasesIdDeudor?: string[] },
  ): Promise<Deudor | null> {
    const helper = new CaseInsensitiveHelper(rawRow);

    // Aliases para identificar el idDeudor en el rawRow.
    // Por defecto: WhatsApp legacy y WAPI usan 'deudor' / 'iddeudor' / 'id_deudor'.
    // Email pasa ['id_contacto'] porque el CSV de cuentas trae esa clave.
    const aliasesIdDeudor = opciones?.aliasesIdDeudor ?? [
      'deudor',
      'iddeudor',
      'id_deudor',
    ];

    const idDeudor = helper.getInt(aliasesIdDeudor);
    if (!idDeudor) {
      this.logger.debug('Sin idDeudor en rawRow - retornando null');
      return null;
    }

    // Extraer campos mapeados
    const nombre = helper.getString(['apenom', 'nombre', 'nombre_completo']);
    const documento = helper.getString(['cuitdoc', 'documento', 'dni', 'doc']);
    const nroEmpresa = helper.getString([
      'nroemp',
      'nro_empresa',
      'nroempresa',
    ]);
    const empresa = helper.getString(['empresa']);
    const remesa = this.normalizeRemesa(helper.getString(['remesa']));

    // Aviso temprano si aparece un ID de empresa sin mapear: permite detectar
    // empresas nuevas del sistema VFP que todavía no están en EMPRESAS_MAP.
    if (empresa && !isEmpresaMapeada(empresa)) {
      this.logger.warn(
        `Empresa sin mapear detectada en upsert: id="${empresa}" (idDeudor=${idDeudor}). Agregarla a empresas.constants.ts.`,
      );
    }

    // Campos excluidos que no van a datos
    const excludedKeys = [
      'numero',
      'mensaje',
      ...helper.getAllMatchingKeys([
        ...aliasesIdDeudor,
        'apenom',
        'nombre',
        'nombre_completo',
        'cuitdoc',
        'documento',
        'dni',
        'doc',
        'nroemp',
        'nro_empresa',
        'nroempresa',
        'empresa',
        'remesa',
      ]),
    ];

    // Construir datos JSON con el resto de campos
    const datosJson = this.buildDatosJson(rawRow, excludedKeys);

    try {
      // Intentar buscar deudor existente
      const existing = await this.prisma.deudor.findUnique({
        where: { idDeudor },
      });

      if (existing) {
        // UPDATE: no pisar con null, hacer deep-merge de datos
        const updateData: Prisma.DeudorUpdateInput = {};

        if (nombre !== null && nombre !== undefined) updateData.nombre = nombre;
        if (documento !== null && documento !== undefined)
          updateData.documento = documento;
        if (nroEmpresa !== null && nroEmpresa !== undefined)
          updateData.nroEmpresa = nroEmpresa;
        if (empresa !== null && empresa !== undefined)
          updateData.empresa = empresa;
        if (remesa !== null && remesa !== undefined)
          updateData.remesa = remesa;

        // Deep-merge de datos
        if (Object.keys(datosJson).length > 0) {
          const existingDatos =
            (existing.datos as Prisma.JsonObject) || {};
          updateData.datos = this.deepMerge(existingDatos, datosJson);
        }

        if (Object.keys(updateData).length > 0) {
          const updated = await this.prisma.deudor.update({
            where: { idDeudor },
            data: updateData,
          });
          this.logger.debug(
            `Deudor ${idDeudor} actualizado (${Object.keys(updateData).length} campos)`,
          );
          return updated;
        } else {
          this.logger.debug(`Deudor ${idDeudor} sin cambios`);
          return existing;
        }
      } else {
        // CREATE
        const created = await this.prisma.deudor.create({
          data: {
            idDeudor,
            nombre: nombre || undefined,
            documento: documento || undefined,
            nroEmpresa: nroEmpresa || undefined,
            empresa: empresa || undefined,
            remesa: remesa || undefined,
            datos: Object.keys(datosJson).length > 0 ? datosJson : undefined,
          },
        });
        this.logger.log(`Deudor ${idDeudor} creado: ${nombre || 'sin nombre'}`);
        return created;
      }
    } catch (error) {
      // Manejo de race condition (P2002 unique constraint)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.warn(
          `Race condition detectada en deudor ${idDeudor} - reintentando`,
        );
        // Reintentar con findUnique + update
        const existing = await this.prisma.deudor.findUnique({
          where: { idDeudor },
        });
        if (existing) {
          const updateData: Prisma.DeudorUpdateInput = {};
          if (nombre !== null && nombre !== undefined)
            updateData.nombre = nombre;
          if (documento !== null && documento !== undefined)
            updateData.documento = documento;
          if (nroEmpresa !== null && nroEmpresa !== undefined)
            updateData.nroEmpresa = nroEmpresa;
          if (empresa !== null && empresa !== undefined)
            updateData.empresa = empresa;
          if (remesa !== null && remesa !== undefined)
            updateData.remesa = remesa;

          if (Object.keys(datosJson).length > 0) {
            const existingDatos =
              (existing.datos as Prisma.JsonObject) || {};
            updateData.datos = this.deepMerge(existingDatos, datosJson);
          }

          if (Object.keys(updateData).length > 0) {
            return await this.prisma.deudor.update({
              where: { idDeudor },
              data: updateData,
            });
          }
          return existing;
        }
      }

      this.logger.error(
        `Error en upsertDesdeImport para deudor ${idDeudor}: ${error.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        `Error al procesar deudor ${idDeudor}`,
      );
    }
  }

  /**
   * Construye el objeto datos JSON excluyendo campos ya mapeados o reservados
   */
  private buildDatosJson(
    rawRow: Record<string, any>,
    excludedKeys: string[],
  ): Record<string, any> {
    const datos: Record<string, any> = {};
    const excludedLowerSet = new Set(
      excludedKeys.map((k) => k.toLowerCase().trim()),
    );

    for (const [key, value] of Object.entries(rawRow)) {
      const keyLower = key.toLowerCase().trim();
      if (!excludedLowerSet.has(keyLower) && value !== null && value !== undefined && value !== '') {
        datos[key] = value;
      }
    }

    return datos;
  }

  /**
   * Deep-merge de dos objetos JSON (para el campo datos)
   */
  private deepMerge(
    existing: Prisma.JsonValue,
    incoming: Record<string, any>,
  ): Prisma.JsonObject {
    const result: Record<string, any> = {};

    // Copiar existente
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      Object.assign(result, existing);
    }

    // Mergear incoming
    for (const [key, value] of Object.entries(incoming)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        result[key] &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = this.deepMerge(result[key], value);
      } else {
        result[key] = value;
      }
    }

    return result as Prisma.JsonObject;
  }

  /**
   * Obtener reporte agregado por empresa
   */
  async obtenerReporteEmpresas(
    query: ReporteQueryDto,
  ): Promise<PaginatedResponse<ReporteEmpresa>> {
    const page = query.page ?? 0;
    const size = Math.min(query.size ?? 20, 100);
    const empresas = query.empresas;
    const remesas = query.remesas;
    const desde = query.desde ? new Date(query.desde) : null;
    const hasta = query.hasta ? new Date(query.hasta) : null;

    this.logger.log(
      `Obteniendo reporte de empresas: empresas=${(empresas || []).join('|') || 'todas'}, remesas=${(remesas || []).join('|') || 'todas'}, desde=${desde?.toISOString() || 'sin límite'}, hasta=${hasta?.toISOString() || 'sin límite'}, page=${page}, size=${size}`,
    );

    try {
      const all = await this.calcularReporteEmpresas(empresas, remesas, desde, hasta);
      const total = all.length;
      const data = all.slice(page * size, page * size + size);
      const totalPages = Math.ceil(total / size);

      this.logger.log(
        `Reporte de empresas obtenido: ${data.length} empresas, total=${total}, página ${page + 1}/${totalPages}`,
      );

      return { data, total, page, size, totalPages };
    } catch (error) {
      this.logger.error(
        `Error al obtener reporte de empresas: ${error.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        'Error al obtener reporte de empresas',
      );
    }
  }

  /**
   * Calcular reporte de empresas sin paginación (para export)
   */
  private async calcularReporteEmpresas(
    empresas: string[] | undefined,
    remesas: string[] | undefined,
    desde: Date | null,
    hasta: Date | null,
  ): Promise<ReporteEmpresa[]> {
    try {
      // Construir WHERE dinámico para empresas y remesas
      const whereEmpresaClause = this.buildEmpresaWhereClause(empresas);
      const whereRemesaClause = this.buildRemesaWhereClause(remesas);

      // Construir WHERE dinámico para fechas
      const whereFechaWa = this.buildFechaWhereClause('r', 'enviadoAt', desde, hasta);
      const whereFechaEmail = this.buildFechaWhereClause('re', 'enviadoAt', desde, hasta);
      const whereFechaWapi = this.buildFechaWhereClause('wr', 'enviadoAt', desde, hasta);
      const whereFechaRebote = this.buildFechaWhereClause('reb', 'fecha', desde, hasta);

      // a) Totales de deudores y conteo de contactos por canal (sin LIMIT para export)
      const queryA = Prisma.sql`
        SELECT
          COALESCE(d.empresa, 'SIN EMPRESA') AS empresa,
          COUNT(DISTINCT d.id) AS totalDeudores,
          COUNT(DISTINCT cw.id) AS contactosWa,
          COUNT(DISTINCT ce.id) AS contactosEmail,
          COUNT(DISTINCT cwa.id) AS contactosWapi
        FROM \`Deudor\` d
        LEFT JOIN \`Contacto\` cw ON cw.deudorId = d.id
        LEFT JOIN \`ContactoEmail\` ce ON ce.deudorId = d.id
        LEFT JOIN \`WaApiContacto\` cwa ON cwa.deudorId = d.id
        WHERE 1=1
          ${whereEmpresaClause}
          ${whereRemesaClause}
        GROUP BY d.empresa
        ORDER BY totalDeudores DESC
      `;

      // b) Envíos WhatsApp legacy por empresa
      const queryB = Prisma.sql`
        SELECT
          COALESCE(d.empresa, 'SIN EMPRESA') AS empresa,
          COUNT(*) AS enviosWa
        FROM \`Reporte\` r
        INNER JOIN \`Contacto\` co ON co.\`campañaId\` = r.\`campañaId\` AND co.numero = r.numero
        INNER JOIN \`Deudor\` d ON d.id = co.deudorId
        WHERE r.enviadoAt IS NOT NULL
          ${whereEmpresaClause}
          ${whereRemesaClause}
          ${whereFechaWa}
        GROUP BY d.empresa
      `;

      // c) Envíos Email + métricas por empresa
      const queryC = Prisma.sql`
        SELECT
          COALESCE(d.empresa, 'SIN EMPRESA') AS empresa,
          COUNT(*) AS enviosEmail,
          SUM(CASE WHEN re.estado IN ('enviado','entregado','delivered','queja') THEN 1 ELSE 0 END) AS entregadosEmail,
          SUM(CASE WHEN re.primeroAbiertoAt IS NOT NULL THEN 1 ELSE 0 END) AS abiertosEmail,
          SUM(CASE WHEN re.primeroClickAt IS NOT NULL THEN 1 ELSE 0 END) AS clicksEmail
        FROM \`ReporteEmail\` re
        INNER JOIN \`ContactoEmail\` co ON co.id = re.contactoId
        INNER JOIN \`Deudor\` d ON d.id = co.deudorId
        WHERE re.enviadoAt IS NOT NULL
          ${whereEmpresaClause}
          ${whereRemesaClause}
          ${whereFechaEmail}
        GROUP BY d.empresa
      `;

      // d) Rebotes Email por empresa
      const queryD = Prisma.sql`
        SELECT
          COALESCE(d.empresa, 'SIN EMPRESA') AS empresa,
          COUNT(DISTINCT reb.reporteId) AS rebotesEmail
        FROM \`EmailRebote\` reb
        INNER JOIN \`ReporteEmail\` re ON re.id = reb.reporteId
        INNER JOIN \`ContactoEmail\` co ON co.id = re.contactoId
        INNER JOIN \`Deudor\` d ON d.id = co.deudorId
        WHERE 1=1
          ${whereEmpresaClause}
          ${whereRemesaClause}
          ${whereFechaRebote}
        GROUP BY d.empresa
      `;

      // e) Envíos WAPI Meta + estados por empresa
      const queryE = Prisma.sql`
        SELECT
          COALESCE(d.empresa, 'SIN EMPRESA') AS empresa,
          COUNT(*) AS enviosWapi,
          SUM(CASE WHEN wr.estado IN ('delivered','read') THEN 1 ELSE 0 END) AS entregadosWapi,
          SUM(CASE WHEN wr.estado = 'read' THEN 1 ELSE 0 END) AS leidosWapi,
          SUM(CASE WHEN wr.estado = 'failed' THEN 1 ELSE 0 END) AS fallidosWapi
        FROM \`WaApiReporte\` wr
        INNER JOIN \`WaApiContacto\` co ON co.id = wr.contactoId
        INNER JOIN \`Deudor\` d ON d.id = co.deudorId
        WHERE wr.enviadoAt IS NOT NULL
          ${whereEmpresaClause}
          ${whereRemesaClause}
          ${whereFechaWapi}
        GROUP BY d.empresa
      `;

      // Ejecutar de forma secuencial para no saturar el pool de conexiones de Prisma
      const rowsA = await this.prisma.$queryRaw<RawEmpresaTotalesRow[]>`${queryA}`;
      const rowsB = await this.prisma.$queryRaw<RawEmpresaEnviosRow[]>`${queryB}`;
      const rowsC = await this.prisma.$queryRaw<RawEmpresaEmailRow[]>`${queryC}`;
      const rowsD = await this.prisma.$queryRaw<RawEmpresaRebotesRow[]>`${queryD}`;
      const rowsE = await this.prisma.$queryRaw<RawEmpresaWapiRow[]>`${queryE}`;

      // Mergear resultados
      const reporteMap = new Map<string, ReporteEmpresa>();

      // Inicializar con rowsA (lista paginada)
      for (const row of rowsA) {
        reporteMap.set(row.empresa, {
          empresa: row.empresa,
          totalDeudores: Number(row.totalDeudores),
          contactosPorCanal: {
            whatsapp: Number(row.contactosWa),
            email: Number(row.contactosEmail),
            wapi: Number(row.contactosWapi),
          },
          envios: { whatsapp: 0, email: 0, wapi: 0 },
          email: {
            entregados: 0,
            abiertos: 0,
            clicks: 0,
            rebotes: 0,
            tasaApertura: 0,
            tasaClick: 0,
          },
          wapi: {
            entregados: 0,
            leidos: 0,
            fallidos: 0,
            tasaEntrega: 0,
            tasaLectura: 0,
          },
        });
      }

      // Rellenar con rowsB (envíos WhatsApp)
      for (const row of rowsB) {
        const reporte = reporteMap.get(row.empresa);
        if (reporte) {
          reporte.envios.whatsapp = Number(row.enviosWa);
        }
      }

      // Rellenar con rowsC (envíos Email)
      for (const row of rowsC) {
        const reporte = reporteMap.get(row.empresa);
        if (reporte) {
          reporte.envios.email = Number(row.enviosEmail);
          reporte.email.entregados = Number(row.entregadosEmail);
          reporte.email.abiertos = Number(row.abiertosEmail);
          reporte.email.clicks = Number(row.clicksEmail);
        }
      }

      // Rellenar con rowsD (rebotes Email)
      for (const row of rowsD) {
        const reporte = reporteMap.get(row.empresa);
        if (reporte) {
          reporte.email.rebotes = Number(row.rebotesEmail);
        }
      }

      // Rellenar con rowsE (envíos WAPI)
      for (const row of rowsE) {
        const reporte = reporteMap.get(row.empresa);
        if (reporte) {
          reporte.envios.wapi = Number(row.enviosWapi);
          reporte.wapi.entregados = Number(row.entregadosWapi);
          reporte.wapi.leidos = Number(row.leidosWapi);
          reporte.wapi.fallidos = Number(row.fallidosWapi);
        }
      }

      // Calcular tasas
      for (const reporte of reporteMap.values()) {
        reporte.email.tasaApertura = this.safeDivide(
          reporte.email.abiertos,
          reporte.email.entregados,
        );
        reporte.email.tasaClick = this.safeDivide(
          reporte.email.clicks,
          reporte.email.entregados,
        );
        reporte.wapi.tasaEntrega = this.safeDivide(
          reporte.wapi.entregados,
          reporte.envios.wapi,
        );
        reporte.wapi.tasaLectura = this.safeDivide(
          reporte.wapi.leidos,
          reporte.wapi.entregados,
        );
      }

      return Array.from(reporteMap.values());
    } catch (error) {
      this.logger.error(
        `Error al calcular reporte de empresas: ${error.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        'Error al calcular reporte de empresas',
      );
    }
  }

  /**
   * Obtener reporte agregado por remesa
   */
  async obtenerReporteRemesas(
    query: ReporteQueryDto,
  ): Promise<PaginatedResponse<ReporteRemesa>> {
    const page = query.page ?? 0;
    const size = Math.min(query.size ?? 20, 100);
    const empresas = query.empresas;
    const remesas = query.remesas;
    const desde = query.desde ? new Date(query.desde) : null;
    const hasta = query.hasta ? new Date(query.hasta) : null;

    this.logger.log(
      `Obteniendo reporte de remesas: empresas=${(empresas || []).join('|') || 'todas'}, remesas=${(remesas || []).join('|') || 'todas'}, desde=${desde?.toISOString() || 'sin límite'}, hasta=${hasta?.toISOString() || 'sin límite'}, page=${page}, size=${size}`,
    );

    try {
      const all = await this.calcularReporteRemesas(empresas, remesas, desde, hasta);
      const total = all.length;
      const data = all.slice(page * size, page * size + size);
      const totalPages = Math.ceil(total / size);

      this.logger.log(
        `Reporte de remesas obtenido: ${data.length} remesas, total=${total}, página ${page + 1}/${totalPages}`,
      );

      return { data, total, page, size, totalPages };
    } catch (error) {
      this.logger.error(
        `Error al obtener reporte de remesas: ${error.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        'Error al obtener reporte de remesas',
      );
    }
  }

  /**
   * Calcular reporte de remesas sin paginación (para export)
   */
  private async calcularReporteRemesas(
    empresas: string[] | undefined,
    remesas: string[] | undefined,
    desde: Date | null,
    hasta: Date | null,
  ): Promise<ReporteRemesa[]> {
    try {
      // Construir WHERE dinámico para empresas y remesas
      const whereEmpresaClause = this.buildEmpresaWhereClause(empresas);
      const whereRemesaClause = this.buildRemesaWhereClause(remesas);

      // Construir WHERE dinámico para fechas
      const whereFechaWa = this.buildFechaWhereClause('r', 'enviadoAt', desde, hasta);
      const whereFechaEmail = this.buildFechaWhereClause('re', 'enviadoAt', desde, hasta);
      const whereFechaWapi = this.buildFechaWhereClause('wr', 'enviadoAt', desde, hasta);
      const whereFechaRebote = this.buildFechaWhereClause('reb', 'fecha', desde, hasta);

      // a) Totales de deudores y conteo de contactos por canal (por empresa y remesa, sin LIMIT para export)
      const queryA = Prisma.sql`
        SELECT
          COALESCE(d.empresa, 'SIN EMPRESA') AS empresa,
          COALESCE(d.remesa, 'SIN REMESA') AS remesa,
          COUNT(DISTINCT d.id) AS totalDeudores,
          COUNT(DISTINCT cw.id) AS contactosWa,
          COUNT(DISTINCT ce.id) AS contactosEmail,
          COUNT(DISTINCT cwa.id) AS contactosWapi
        FROM \`Deudor\` d
        LEFT JOIN \`Contacto\` cw ON cw.deudorId = d.id
        LEFT JOIN \`ContactoEmail\` ce ON ce.deudorId = d.id
        LEFT JOIN \`WaApiContacto\` cwa ON cwa.deudorId = d.id
        WHERE 1=1
          ${whereEmpresaClause}
          ${whereRemesaClause}
        GROUP BY d.empresa, d.remesa
        ORDER BY d.empresa ASC, totalDeudores DESC
      `;

      // b) Envíos WhatsApp legacy por empresa y remesa
      const queryB = Prisma.sql`
        SELECT
          COALESCE(d.empresa, 'SIN EMPRESA') AS empresa,
          COALESCE(d.remesa, 'SIN REMESA') AS remesa,
          COUNT(*) AS enviosWa
        FROM \`Reporte\` r
        INNER JOIN \`Contacto\` co ON co.\`campañaId\` = r.\`campañaId\` AND co.numero = r.numero
        INNER JOIN \`Deudor\` d ON d.id = co.deudorId
        WHERE r.enviadoAt IS NOT NULL
          ${whereEmpresaClause}
          ${whereRemesaClause}
          ${whereFechaWa}
        GROUP BY d.empresa, d.remesa
      `;

      // c) Envíos Email + métricas por empresa y remesa
      const queryC = Prisma.sql`
        SELECT
          COALESCE(d.empresa, 'SIN EMPRESA') AS empresa,
          COALESCE(d.remesa, 'SIN REMESA') AS remesa,
          COUNT(*) AS enviosEmail,
          SUM(CASE WHEN re.estado IN ('enviado','entregado','delivered','queja') THEN 1 ELSE 0 END) AS entregadosEmail,
          SUM(CASE WHEN re.primeroAbiertoAt IS NOT NULL THEN 1 ELSE 0 END) AS abiertosEmail,
          SUM(CASE WHEN re.primeroClickAt IS NOT NULL THEN 1 ELSE 0 END) AS clicksEmail
        FROM \`ReporteEmail\` re
        INNER JOIN \`ContactoEmail\` co ON co.id = re.contactoId
        INNER JOIN \`Deudor\` d ON d.id = co.deudorId
        WHERE re.enviadoAt IS NOT NULL
          ${whereEmpresaClause}
          ${whereRemesaClause}
          ${whereFechaEmail}
        GROUP BY d.empresa, d.remesa
      `;

      // d) Rebotes Email por empresa y remesa
      const queryD = Prisma.sql`
        SELECT
          COALESCE(d.empresa, 'SIN EMPRESA') AS empresa,
          COALESCE(d.remesa, 'SIN REMESA') AS remesa,
          COUNT(DISTINCT reb.reporteId) AS rebotesEmail
        FROM \`EmailRebote\` reb
        INNER JOIN \`ReporteEmail\` re ON re.id = reb.reporteId
        INNER JOIN \`ContactoEmail\` co ON co.id = re.contactoId
        INNER JOIN \`Deudor\` d ON d.id = co.deudorId
        WHERE 1=1
          ${whereEmpresaClause}
          ${whereRemesaClause}
          ${whereFechaRebote}
        GROUP BY d.empresa, d.remesa
      `;

      // e) Envíos WAPI Meta + estados por empresa y remesa
      const queryE = Prisma.sql`
        SELECT
          COALESCE(d.empresa, 'SIN EMPRESA') AS empresa,
          COALESCE(d.remesa, 'SIN REMESA') AS remesa,
          COUNT(*) AS enviosWapi,
          SUM(CASE WHEN wr.estado IN ('delivered','read') THEN 1 ELSE 0 END) AS entregadosWapi,
          SUM(CASE WHEN wr.estado = 'read' THEN 1 ELSE 0 END) AS leidosWapi,
          SUM(CASE WHEN wr.estado = 'failed' THEN 1 ELSE 0 END) AS fallidosWapi
        FROM \`WaApiReporte\` wr
        INNER JOIN \`WaApiContacto\` co ON co.id = wr.contactoId
        INNER JOIN \`Deudor\` d ON d.id = co.deudorId
        WHERE wr.enviadoAt IS NOT NULL
          ${whereEmpresaClause}
          ${whereRemesaClause}
          ${whereFechaWapi}
        GROUP BY d.empresa, d.remesa
      `;

      // Ejecutar de forma secuencial para no saturar el pool de conexiones de Prisma
      const rowsA = await this.prisma.$queryRaw<RawRemesaTotalesRow[]>`${queryA}`;
      const rowsB = await this.prisma.$queryRaw<RawRemesaEnviosRow[]>`${queryB}`;
      const rowsC = await this.prisma.$queryRaw<RawRemesaEmailRow[]>`${queryC}`;
      const rowsD = await this.prisma.$queryRaw<RawRemesaRebotesRow[]>`${queryD}`;
      const rowsE = await this.prisma.$queryRaw<RawRemesaWapiRow[]>`${queryE}`;

      // Mergear resultados (key = empresa||remesa)
      const reporteMap = new Map<string, ReporteRemesa>();

      // Inicializar con rowsA (lista paginada)
      for (const row of rowsA) {
        const key = `${row.empresa}||${row.remesa}`;
        reporteMap.set(key, {
          empresa: row.empresa,
          remesa: row.remesa,
          totalDeudores: Number(row.totalDeudores),
          contactosPorCanal: {
            whatsapp: Number(row.contactosWa),
            email: Number(row.contactosEmail),
            wapi: Number(row.contactosWapi),
          },
          envios: { whatsapp: 0, email: 0, wapi: 0 },
          email: {
            entregados: 0,
            abiertos: 0,
            clicks: 0,
            rebotes: 0,
            tasaApertura: 0,
            tasaClick: 0,
          },
          wapi: {
            entregados: 0,
            leidos: 0,
            fallidos: 0,
            tasaEntrega: 0,
            tasaLectura: 0,
          },
        });
      }

      // Rellenar con rowsB (envíos WhatsApp)
      for (const row of rowsB) {
        const key = `${row.empresa}||${row.remesa}`;
        const reporte = reporteMap.get(key);
        if (reporte) {
          reporte.envios.whatsapp = Number(row.enviosWa);
        }
      }

      // Rellenar con rowsC (envíos Email)
      for (const row of rowsC) {
        const key = `${row.empresa}||${row.remesa}`;
        const reporte = reporteMap.get(key);
        if (reporte) {
          reporte.envios.email = Number(row.enviosEmail);
          reporte.email.entregados = Number(row.entregadosEmail);
          reporte.email.abiertos = Number(row.abiertosEmail);
          reporte.email.clicks = Number(row.clicksEmail);
        }
      }

      // Rellenar con rowsD (rebotes Email)
      for (const row of rowsD) {
        const key = `${row.empresa}||${row.remesa}`;
        const reporte = reporteMap.get(key);
        if (reporte) {
          reporte.email.rebotes = Number(row.rebotesEmail);
        }
      }

      // Rellenar con rowsE (envíos WAPI)
      for (const row of rowsE) {
        const key = `${row.empresa}||${row.remesa}`;
        const reporte = reporteMap.get(key);
        if (reporte) {
          reporte.envios.wapi = Number(row.enviosWapi);
          reporte.wapi.entregados = Number(row.entregadosWapi);
          reporte.wapi.leidos = Number(row.leidosWapi);
          reporte.wapi.fallidos = Number(row.fallidosWapi);
        }
      }

      // Calcular tasas
      for (const reporte of reporteMap.values()) {
        reporte.email.tasaApertura = this.safeDivide(
          reporte.email.abiertos,
          reporte.email.entregados,
        );
        reporte.email.tasaClick = this.safeDivide(
          reporte.email.clicks,
          reporte.email.entregados,
        );
        reporte.wapi.tasaEntrega = this.safeDivide(
          reporte.wapi.entregados,
          reporte.envios.wapi,
        );
        reporte.wapi.tasaLectura = this.safeDivide(
          reporte.wapi.leidos,
          reporte.wapi.entregados,
        );
      }

      return Array.from(reporteMap.values());
    } catch (error) {
      this.logger.error(
        `Error al calcular reporte de remesas: ${error.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        'Error al calcular reporte de remesas',
      );
    }
  }

  /**
   * Exportar reporte a CSV o XLSX
   */
  async exportarReporte(query: ExportarReporteDto): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string;
  }> {
    const desde = query.desde ? new Date(query.desde) : null;
    const hasta = query.hasta ? new Date(query.hasta) : null;

    const baseName = this.buildExportFilename(`reporte-${query.tipo}`, {
      empresas: query.empresas,
      desde,
      hasta,
    });

    this.logger.log(
      `Exportando reporte: tipo=${query.tipo}, formato=${query.formato}, empresas=${(query.empresas || []).join('|') || 'todas'}, desde=${desde?.toISOString() || 'sin límite'}, hasta=${hasta?.toISOString() || 'sin límite'}`,
    );

    try {
      let buffer: Buffer;
      let filename: string;
      let contentType: string;

      if (query.tipo === 'empresa') {
        const data = await this.calcularReporteEmpresas(query.empresas, query.remesas, desde, hasta);
        if (query.formato === 'csv') {
          buffer = await this.generarCsvEmpresas(data);
          filename = `${baseName}.csv`;
          contentType = 'text/csv; charset=utf-8';
        } else {
          buffer = await this.generarXlsxEmpresas(data);
          filename = `${baseName}.xlsx`;
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }
      } else {
        const data = await this.calcularReporteRemesas(query.empresas, query.remesas, desde, hasta);
        if (query.formato === 'csv') {
          buffer = await this.generarCsvRemesas(data);
          filename = `${baseName}.csv`;
          contentType = 'text/csv; charset=utf-8';
        } else {
          buffer = await this.generarXlsxRemesas(data);
          filename = `${baseName}.xlsx`;
          contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }
      }

      this.logger.log(`Reporte exportado: ${filename} (${buffer.length} bytes)`);
      return { buffer, filename, contentType };
    } catch (error) {
      this.logger.error(
        `Error al exportar reporte: ${error.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException('Error al exportar reporte');
    }
  }

  /**
   * Generar CSV de reporte de empresas
   */
  private async generarCsvEmpresas(reportes: ReporteEmpresa[]): Promise<Buffer> {
    const headers = [
      'Empresa',
      'Total Deudores',
      'Contactos WhatsApp',
      'Contactos Email',
      'Contactos WAPI',
      'Envíos WhatsApp',
      'Envíos Email',
      'Envíos WAPI',
      'Email Entregados',
      'Email Abiertos',
      'Email Clicks',
      'Email Rebotes',
      '% Apertura Email',
      '% Click Email',
      'WAPI Entregados',
      'WAPI Leídos',
      'WAPI Fallidos',
      '% Entrega WAPI',
      '% Lectura WAPI',
    ];

    const lines: string[] = [headers.join(';')];

    for (const r of reportes) {
      const row = [
        this.escapeCsv(r.empresa),
        r.totalDeudores.toString(),
        r.contactosPorCanal.whatsapp.toString(),
        r.contactosPorCanal.email.toString(),
        r.contactosPorCanal.wapi.toString(),
        r.envios.whatsapp.toString(),
        r.envios.email.toString(),
        r.envios.wapi.toString(),
        r.email.entregados.toString(),
        r.email.abiertos.toString(),
        r.email.clicks.toString(),
        r.email.rebotes.toString(),
        this.formatPercentageCsv(r.email.tasaApertura),
        this.formatPercentageCsv(r.email.tasaClick),
        r.wapi.entregados.toString(),
        r.wapi.leidos.toString(),
        r.wapi.fallidos.toString(),
        this.formatPercentageCsv(r.wapi.tasaEntrega),
        this.formatPercentageCsv(r.wapi.tasaLectura),
      ];
      lines.push(row.join(';'));
    }

    return Buffer.from('\uFEFF' + lines.join('\n'), 'utf-8');
  }

  /**
   * Generar CSV de reporte de remesas
   */
  private async generarCsvRemesas(reportes: ReporteRemesa[]): Promise<Buffer> {
    const headers = [
      'Empresa',
      'Remesa',
      'Total Deudores',
      'Contactos WhatsApp',
      'Contactos Email',
      'Contactos WAPI',
      'Envíos WhatsApp',
      'Envíos Email',
      'Envíos WAPI',
      'Email Entregados',
      'Email Abiertos',
      'Email Clicks',
      'Email Rebotes',
      '% Apertura Email',
      '% Click Email',
      'WAPI Entregados',
      'WAPI Leídos',
      'WAPI Fallidos',
      '% Entrega WAPI',
      '% Lectura WAPI',
    ];

    const lines: string[] = [headers.join(';')];

    for (const r of reportes) {
      const row = [
        this.escapeCsv(r.empresa),
        this.escapeCsv(r.remesa),
        r.totalDeudores.toString(),
        r.contactosPorCanal.whatsapp.toString(),
        r.contactosPorCanal.email.toString(),
        r.contactosPorCanal.wapi.toString(),
        r.envios.whatsapp.toString(),
        r.envios.email.toString(),
        r.envios.wapi.toString(),
        r.email.entregados.toString(),
        r.email.abiertos.toString(),
        r.email.clicks.toString(),
        r.email.rebotes.toString(),
        this.formatPercentageCsv(r.email.tasaApertura),
        this.formatPercentageCsv(r.email.tasaClick),
        r.wapi.entregados.toString(),
        r.wapi.leidos.toString(),
        r.wapi.fallidos.toString(),
        this.formatPercentageCsv(r.wapi.tasaEntrega),
        this.formatPercentageCsv(r.wapi.tasaLectura),
      ];
      lines.push(row.join(';'));
    }

    return Buffer.from('\uFEFF' + lines.join('\n'), 'utf-8');
  }

  /**
   * Generar XLSX de reporte de empresas
   */
  private async generarXlsxEmpresas(reportes: ReporteEmpresa[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AMSA Sender';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Reporte Empresas');

    worksheet.columns = [
      { header: 'Empresa', key: 'empresa', width: 25 },
      { header: 'Total Deudores', key: 'totalDeudores', width: 15 },
      { header: 'Contactos WhatsApp', key: 'contactosWa', width: 18 },
      { header: 'Contactos Email', key: 'contactosEmail', width: 18 },
      { header: 'Contactos WAPI', key: 'contactosWapi', width: 18 },
      { header: 'Envíos WhatsApp', key: 'enviosWa', width: 15 },
      { header: 'Envíos Email', key: 'enviosEmail', width: 15 },
      { header: 'Envíos WAPI', key: 'enviosWapi', width: 15 },
      { header: 'Email Entregados', key: 'emailEntregados', width: 18 },
      { header: 'Email Abiertos', key: 'emailAbiertos', width: 18 },
      { header: 'Email Clicks', key: 'emailClicks', width: 15 },
      { header: 'Email Rebotes', key: 'emailRebotes', width: 15 },
      { header: '% Apertura Email', key: 'emailTasaApertura', width: 18, style: { numFmt: '0.00%' } },
      { header: '% Click Email', key: 'emailTasaClick', width: 18, style: { numFmt: '0.00%' } },
      { header: 'WAPI Entregados', key: 'wapiEntregados', width: 18 },
      { header: 'WAPI Leídos', key: 'wapiLeidos', width: 15 },
      { header: 'WAPI Fallidos', key: 'wapiFallidos', width: 15 },
      { header: '% Entrega WAPI', key: 'wapiTasaEntrega', width: 18, style: { numFmt: '0.00%' } },
      { header: '% Lectura WAPI', key: 'wapiTasaLectura', width: 18, style: { numFmt: '0.00%' } },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    for (const r of reportes) {
      worksheet.addRow({
        empresa: r.empresa,
        totalDeudores: r.totalDeudores,
        contactosWa: r.contactosPorCanal.whatsapp,
        contactosEmail: r.contactosPorCanal.email,
        contactosWapi: r.contactosPorCanal.wapi,
        enviosWa: r.envios.whatsapp,
        enviosEmail: r.envios.email,
        enviosWapi: r.envios.wapi,
        emailEntregados: r.email.entregados,
        emailAbiertos: r.email.abiertos,
        emailClicks: r.email.clicks,
        emailRebotes: r.email.rebotes,
        emailTasaApertura: r.email.tasaApertura,
        emailTasaClick: r.email.tasaClick,
        wapiEntregados: r.wapi.entregados,
        wapiLeidos: r.wapi.leidos,
        wapiFallidos: r.wapi.fallidos,
        wapiTasaEntrega: r.wapi.tasaEntrega,
        wapiTasaLectura: r.wapi.tasaLectura,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generar XLSX de reporte de remesas
   */
  private async generarXlsxRemesas(reportes: ReporteRemesa[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AMSA Sender';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Reporte Remesas');

    worksheet.columns = [
      { header: 'Empresa', key: 'empresa', width: 25 },
      { header: 'Remesa', key: 'remesa', width: 25 },
      { header: 'Total Deudores', key: 'totalDeudores', width: 15 },
      { header: 'Contactos WhatsApp', key: 'contactosWa', width: 18 },
      { header: 'Contactos Email', key: 'contactosEmail', width: 18 },
      { header: 'Contactos WAPI', key: 'contactosWapi', width: 18 },
      { header: 'Envíos WhatsApp', key: 'enviosWa', width: 15 },
      { header: 'Envíos Email', key: 'enviosEmail', width: 15 },
      { header: 'Envíos WAPI', key: 'enviosWapi', width: 15 },
      { header: 'Email Entregados', key: 'emailEntregados', width: 18 },
      { header: 'Email Abiertos', key: 'emailAbiertos', width: 18 },
      { header: 'Email Clicks', key: 'emailClicks', width: 15 },
      { header: 'Email Rebotes', key: 'emailRebotes', width: 15 },
      { header: '% Apertura Email', key: 'emailTasaApertura', width: 18, style: { numFmt: '0.00%' } },
      { header: '% Click Email', key: 'emailTasaClick', width: 18, style: { numFmt: '0.00%' } },
      { header: 'WAPI Entregados', key: 'wapiEntregados', width: 18 },
      { header: 'WAPI Leídos', key: 'wapiLeidos', width: 15 },
      { header: 'WAPI Fallidos', key: 'wapiFallidos', width: 15 },
      { header: '% Entrega WAPI', key: 'wapiTasaEntrega', width: 18, style: { numFmt: '0.00%' } },
      { header: '% Lectura WAPI', key: 'wapiTasaLectura', width: 18, style: { numFmt: '0.00%' } },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    for (const r of reportes) {
      worksheet.addRow({
        empresa: r.empresa,
        remesa: r.remesa,
        totalDeudores: r.totalDeudores,
        contactosWa: r.contactosPorCanal.whatsapp,
        contactosEmail: r.contactosPorCanal.email,
        contactosWapi: r.contactosPorCanal.wapi,
        enviosWa: r.envios.whatsapp,
        enviosEmail: r.envios.email,
        enviosWapi: r.envios.wapi,
        emailEntregados: r.email.entregados,
        emailAbiertos: r.email.abiertos,
        emailClicks: r.email.clicks,
        emailRebotes: r.email.rebotes,
        emailTasaApertura: r.email.tasaApertura,
        emailTasaClick: r.email.tasaClick,
        wapiEntregados: r.wapi.entregados,
        wapiLeidos: r.wapi.leidos,
        wapiFallidos: r.wapi.fallidos,
        wapiTasaEntrega: r.wapi.tasaEntrega,
        wapiTasaLectura: r.wapi.tasaLectura,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Exportar actividades detalladas (fila por actividad)
   */
  async exportarDetalle(query: ExportarDetalleDto): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string;
  }> {
    const desde = query.desde ? new Date(query.desde) : null;
    const hasta = query.hasta ? new Date(query.hasta) : null;

    const baseName = this.buildExportFilename('actividades', {
      empresas: query.empresas,
      remesas: query.remesas,
      canal: query.canal,
      desde,
      hasta,
    });

    this.logger.log(
      `Exportando actividades detalladas: formato=${query.formato}, empresas=${(query.empresas || []).join('|') || 'todas'}, remesas=${(query.remesas || []).join('|') || 'todas'}, canal=${query.canal || 'todos'}, desde=${desde?.toISOString() || 'sin límite'}, hasta=${hasta?.toISOString() || 'sin límite'}`,
    );

    try {
      const data = await this.obtenerDetalleActividades(
        query.empresas,
        query.remesas,
        query.canal,
        desde,
        hasta
      );

      let buffer: Buffer;
      let filename: string;
      let contentType: string;

      if (query.formato === 'csv') {
        buffer = await this.generarCsvDetalle(data);
        filename = `${baseName}.csv`;
        contentType = 'text/csv; charset=utf-8';
      } else {
        buffer = await this.generarXlsxDetalle(data);
        filename = `${baseName}.xlsx`;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }

      this.logger.log(`Detalle exportado: ${filename} (${buffer.length} bytes)`);
      return { buffer, filename, contentType };
    } catch (error) {
      this.logger.error(
        `Error al exportar detalle de actividades: ${error.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException('Error al exportar detalle de actividades');
    }
  }

  private async obtenerDetalleActividades(
    empresas?: string[],
    remesas?: string[],
    canal?: string,
    desde?: Date | null,
    hasta?: Date | null,
  ): Promise<RawDetalleRow[]> {
    const parts: Prisma.Sql[] = [];

    // Condicionales de Deudor
    const deudorWhereClauses: Prisma.Sql[] = [Prisma.sql`1=1`];
    if (empresas && empresas.length > 0) {
      if (empresas.length === 1) {
        deudorWhereClauses.push(Prisma.sql`d.empresa = ${empresas[0]}`);
      } else {
        deudorWhereClauses.push(Prisma.sql`d.empresa IN (${Prisma.join(empresas)})`);
      }
    }
    if (remesas && remesas.length > 0) {
      if (remesas.length === 1) {
        deudorWhereClauses.push(Prisma.sql`d.remesa = ${remesas[0]}`);
      } else {
        deudorWhereClauses.push(Prisma.sql`d.remesa IN (${Prisma.join(remesas)})`);
      }
    }
    const deudorWhereCondition = Prisma.join(deudorWhereClauses, ' AND ');

    // a) WhatsApp legacy
    if (!canal || canal === 'whatsapp') {
      const subWa = Prisma.sql`
        SELECT
          d.idDeudor, d.nombre, d.documento, d.empresa, d.nroEmpresa, d.remesa,
          'WhatsApp Web' AS canal,
          'Envío' AS tipo,
          r.numero AS destinatario,
          r.\`enviadoAt\` AS fecha,
          COALESCE(r.estado, 'pendiente') AS estado,
          NULL AS asunto,
          NULL AS templateNombre,
          NULL AS urlDestino,
          NULL AS errorMsg,
          c.nombre AS campaniaNombre
        FROM \`Reporte\` r
        INNER JOIN \`Contacto\` co ON co.\`campañaId\` = r.\`campañaId\` AND co.numero = r.numero
        INNER JOIN \`Deudor\` d ON d.id = co.deudorId
        LEFT JOIN \`Campaña\` c ON c.id = r.\`campañaId\`
        WHERE r.\`enviadoAt\` IS NOT NULL AND ${deudorWhereCondition}
      `;
      parts.push(subWa);
    }

    // b) Email envíos y eventos
    if (!canal || canal === 'email') {
      const subEmailEnvios = Prisma.sql`
        SELECT
          d.idDeudor, d.nombre, d.documento, d.empresa, d.nroEmpresa, d.remesa,
          'Email' AS canal,
          'Envío' AS tipo,
          co.email AS destinatario,
          re.\`enviadoAt\` AS fecha,
          COALESCE(re.estado, 'pendiente') AS estado,
          re.asunto AS asunto,
          NULL AS templateNombre,
          NULL AS urlDestino,
          re.error AS errorMsg,
          ce.nombre AS campaniaNombre
        FROM \`ReporteEmail\` re
        INNER JOIN \`ContactoEmail\` co ON co.id = re.\`contactoId\`
        INNER JOIN \`Deudor\` d ON d.id = co.deudorId
        LEFT JOIN \`CampañaEmail\` ce ON ce.id = re.\`campañaId\`
        WHERE re.\`enviadoAt\` IS NOT NULL AND ${deudorWhereCondition}
      `;
      parts.push(subEmailEnvios);

      const subEmailEventos = Prisma.sql`
        SELECT
          d.idDeudor, d.nombre, d.documento, d.empresa, d.nroEmpresa, d.remesa,
          'Email' AS canal,
          CASE WHEN ev.tipo = 'OPEN' THEN 'Apertura' WHEN ev.tipo = 'CLICK' THEN 'Click' ELSE ev.tipo END AS tipo,
          co.email AS destinatario,
          ev.fecha AS fecha,
          'Evento' AS estado,
          re.asunto AS asunto,
          NULL AS templateNombre,
          ev.\`urlDestino\` AS urlDestino,
          NULL AS errorMsg,
          ce.nombre AS campaniaNombre
        FROM \`EmailEvento\` ev
        INNER JOIN \`ReporteEmail\` re ON re.id = ev.\`reporteId\`
        INNER JOIN \`ContactoEmail\` co ON co.id = re.\`contactoId\`
        INNER JOIN \`Deudor\` d ON d.id = co.deudorId
        LEFT JOIN \`CampañaEmail\` ce ON ce.id = re.\`campañaId\`
        WHERE ${deudorWhereCondition}
      `;
      parts.push(subEmailEventos);
    }

    // c) WAPI Meta
    if (!canal || canal === 'wapi') {
      const subWapi = Prisma.sql`
        SELECT
          d.idDeudor, d.nombre, d.documento, d.empresa, d.nroEmpresa, d.remesa,
          'WhatsApp Meta' AS canal,
          'Envío' AS tipo,
          wco.numero AS destinatario,
          wr.\`enviadoAt\` AS fecha,
          COALESCE(wr.estado, 'pendiente') AS estado,
          NULL AS asunto,
          wt.\`metaNombre\` AS templateNombre,
          NULL AS urlDestino,
          wr.error AS errorMsg,
          wc.nombre AS campaniaNombre
        FROM \`WaApiReporte\` wr
        INNER JOIN \`WaApiContacto\` wco ON wco.id = wr.\`contactoId\`
        INNER JOIN \`Deudor\` d ON d.id = wco.deudorId
        LEFT JOIN \`WaApiCampaña\` wc ON wc.id = wr.\`campañaId\`
        LEFT JOIN \`WaApiTemplate\` wt ON wt.id = wc.\`templateId\`
        WHERE wr.\`enviadoAt\` IS NOT NULL AND ${deudorWhereCondition}
      `;
      parts.push(subWapi);
    }

    if (parts.length === 0) {
      return [];
    }

    const unionAll = Prisma.join(parts, ' UNION ALL ');

    const whereClauses: Prisma.Sql[] = [Prisma.sql`1=1`];
    if (desde) {
      whereClauses.push(Prisma.sql`t.fecha >= ${desde}`);
    }
    if (hasta) {
      whereClauses.push(Prisma.sql`t.fecha <= ${hasta}`);
    }
    const whereCondition = Prisma.join(whereClauses, ' AND ');

    const rows = await this.prisma.$queryRaw<RawDetalleRow[]>`
      SELECT * FROM (${unionAll}) t
      WHERE ${whereCondition}
      ORDER BY t.fecha DESC
    `;
    
    return rows;
  }

  private async generarCsvDetalle(data: RawDetalleRow[]): Promise<Buffer> {
    const headers = [
      'ID Deudor', 'Nombre', 'Documento', 'Empresa', 'N° Empresa', 'Remesa',
      'Canal', 'Tipo', 'Destinatario', 'Fecha', 'Estado',
      'Asunto', 'Template', 'URL Destino', 'Error', 'Campaña'
    ];
    const lines: string[] = [headers.join(';')];

    for (const row of data) {
      const csvRow = [
        row.idDeudor?.toString() || '',
        this.escapeCsv(row.nombre),
        this.escapeCsv(row.documento),
        this.escapeCsv(row.empresa),
        this.escapeCsv(row.nroEmpresa),
        this.escapeCsv(row.remesa),
        this.escapeCsv(row.canal),
        this.escapeCsv(row.tipo),
        this.escapeCsv(row.destinatario),
        row.fecha ? new Date(row.fecha).toISOString() : '',
        this.escapeCsv(row.estado),
        this.escapeCsv(row.asunto),
        this.escapeCsv(row.templateNombre),
        this.escapeCsv(row.urlDestino),
        this.escapeCsv(row.errorMsg),
        this.escapeCsv(row.campaniaNombre),
      ];
      lines.push(csvRow.join(';'));
    }

    return Buffer.from('\uFEFF' + lines.join('\n'), 'utf-8');
  }

  private async generarXlsxDetalle(data: RawDetalleRow[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AMSA Sender';
    workbook.created = new Date();
    const worksheet = workbook.addWorksheet('Actividades');

    worksheet.columns = [
      { header: 'ID Deudor', key: 'idDeudor', width: 12 },
      { header: 'Nombre', key: 'nombre', width: 25 },
      { header: 'Documento', key: 'documento', width: 15 },
      { header: 'Empresa', key: 'empresa', width: 20 },
      { header: 'N° Empresa', key: 'nroEmpresa', width: 15 },
      { header: 'Remesa', key: 'remesa', width: 20 },
      { header: 'Canal', key: 'canal', width: 15 },
      { header: 'Tipo', key: 'tipo', width: 12 },
      { header: 'Destinatario', key: 'destinatario', width: 20 },
      { header: 'Fecha', key: 'fecha', width: 22 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Asunto', key: 'asunto', width: 25 },
      { header: 'Template', key: 'template', width: 20 },
      { header: 'URL Destino', key: 'urlDestino', width: 25 },
      { header: 'Error', key: 'error', width: 25 },
      { header: 'Campaña', key: 'campania', width: 20 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    for (const row of data) {
      worksheet.addRow({
        idDeudor: row.idDeudor,
        nombre: row.nombre,
        documento: row.documento,
        empresa: row.empresa,
        nroEmpresa: row.nroEmpresa,
        remesa: row.remesa,
        canal: row.canal,
        tipo: row.tipo,
        destinatario: row.destinatario,
        fecha: row.fecha ? new Date(row.fecha).toLocaleString() : '',
        estado: row.estado,
        asunto: row.asunto,
        template: row.templateNombre,
        urlDestino: row.urlDestino,
        error: row.errorMsg,
        campania: row.campaniaNombre,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Helper: escapar campo CSV con separador ;
   */
  private escapeCsv(value: string | null | undefined): string {
    if (!value) return '';
    const str = String(value);
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Helper: formatear porcentaje para CSV (como string con %)
   */
  private formatPercentageCsv(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
  }

  /**
   * Helper: construir WHERE clause para filtros de fecha
   */
  private buildFechaWhereClause(
    tableAlias: string,
    columnName: string,
    desde: Date | null,
    hasta: Date | null,
  ): Prisma.Sql {
    const parts: Prisma.Sql[] = [];
    if (desde) {
      parts.push(Prisma.sql`AND ${Prisma.raw(tableAlias)}.${Prisma.raw(columnName)} >= ${desde}`);
    }
    if (hasta) {
      parts.push(Prisma.sql`AND ${Prisma.raw(tableAlias)}.${Prisma.raw(columnName)} <= ${hasta}`);
    }
    return parts.length > 0 ? Prisma.join(parts, ' ') : Prisma.empty;
  }

  /**
   * Normaliza el campo remesa: numérico, máximo 5 caracteres, sin ceros a la izquierda.
   * "000490" -> "490", "00" -> "0", "490" -> "490".
   * Si no es todo dígitos, se deja el valor trimmeado (se loguea warning).
   */
  private normalizeRemesa(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const trimmed = String(value).trim();
    if (trimmed === '') return null;

    if (!/^\d+$/.test(trimmed)) {
      this.logger.warn(`Remesa no numérica recibida: "${trimmed}" - se mantiene sin normalizar`);
      return trimmed;
    }

    const stripped = trimmed.replace(/^0+/, '') || '0';

    if (stripped.length > 5) {
      this.logger.warn(`Remesa excede 5 caracteres tras normalizar: "${trimmed}" -> "${stripped}"`);
    }

    return stripped;
  }

  /**
   * Helper: construye la cláusula WHERE para filtro de empresas (soporta múltiples)
   */
  private buildEmpresaWhereClause(empresas: string[] | undefined): Prisma.Sql {
    if (!empresas || empresas.length === 0) return Prisma.empty;
    if (empresas.length === 1) {
      return Prisma.sql`AND d.empresa = ${empresas[0]}`;
    }
    return Prisma.sql`AND d.empresa IN (${Prisma.join(empresas)})`;
  }

  /**
   * Helper: construye la cláusula WHERE para filtro de remesas (soporta múltiples)
   */
  private buildRemesaWhereClause(remesas: string[] | undefined): Prisma.Sql {
    if (!remesas || remesas.length === 0) return Prisma.empty;
    if (remesas.length === 1) {
      return Prisma.sql`AND d.remesa = ${remesas[0]}`;
    }
    return Prisma.sql`AND d.remesa IN (${Prisma.join(remesas)})`;
  }

  /**
   * Helper: construye un nombre de archivo descriptivo para exportaciones
   * Incluye empresas, remesas, canal, rango de fechas y timestamp
   */
  private buildExportFilename(
    prefix: string,
    opts: {
      empresas?: string[];
      remesas?: string[];
      canal?: string;
      desde?: Date | null;
      hasta?: Date | null;
    },
  ): string {
    const sanitize = (s: string): string =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24);

    const summarize = (arr: string[]): string => {
      if (arr.length <= 2) {
        return arr.map(sanitize).filter(Boolean).join('-');
      }
      return `${arr.slice(0, 2).map(sanitize).filter(Boolean).join('-')}-y${arr.length - 2}mas`;
    };

    const parts: string[] = [prefix];

    if (opts.empresas && opts.empresas.length > 0) {
      const s = summarize(opts.empresas);
      if (s) parts.push(`emp-${s}`);
    }
    if (opts.remesas && opts.remesas.length > 0) {
      const s = summarize(opts.remesas);
      if (s) parts.push(`rem-${s}`);
    }
    if (opts.canal) {
      parts.push(`canal-${sanitize(opts.canal)}`);
    }
    if (opts.desde) {
      parts.push(`desde-${opts.desde.toISOString().slice(0, 10)}`);
    }
    if (opts.hasta) {
      parts.push(`hasta-${opts.hasta.toISOString().slice(0, 10)}`);
    }

    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    parts.push(ts);

    return parts.join('_');
  }

  /**
   * Helper: división segura (retorna 0 si denominador es 0)
   * Redondea a 4 decimales
   */
  private safeDivide(numerador: number, denominador: number): number {
    if (denominador === 0) return 0;
    return Math.round((numerador / denominador) * 10000) / 10000;
  }

  /**
   * Obtener timeline de interacciones del deudor (omnicanal)
   */
  async obtenerTimeline(
    id: number,
    query: TimelineQueryDto,
  ): Promise<PaginatedResponse<TimelineEntry>> {
    // Validar id
    if (!id || id <= 0 || !Number.isInteger(id)) {
      throw new BadRequestException('El ID del deudor debe ser un entero positivo');
    }

    this.logger.log(`Obteniendo timeline del deudor id=${id}`);

    try {
      // Verificar que el deudor existe
      const deudorExiste = await this.prisma.deudor.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!deudorExiste) {
        throw new NotFoundException(`Deudor con id=${id} no encontrado`);
      }

      // Defaults
      const page = query.page ?? 0;
      const size = query.size ?? 30;
      const canal = query.canal;
      const desde = query.desde ? new Date(query.desde) : null;
      const hasta = query.hasta ? new Date(query.hasta) : null;

      this.logger.log(
        `Timeline filters: canal=${canal || 'todos'}, desde=${desde?.toISOString() || 'sin límite'}, hasta=${hasta?.toISOString() || 'sin límite'}, page=${page}, size=${size}`,
      );

      // Construir subqueries dinámicamente según filtro de canal
      const parts: Prisma.Sql[] = [];

      // a) WhatsApp legacy
      if (!canal || canal === 'whatsapp') {
        const subWa = Prisma.sql`
          SELECT
            CONCAT('wa-', r.id) AS id,
            'whatsapp' AS canal,
            'envio' AS tipo,
            r.\`enviadoAt\` AS fecha,
            r.estado AS estado,
            NULL AS asunto,
            r.mensaje AS mensaje,
            NULL AS templateNombre,
            NULL AS errorMsg,
            NULL AS urlDestino,
            c.id AS campaniaId,
            c.nombre AS campaniaNombre,
            co.id AS contactoId
          FROM \`Reporte\` r
          INNER JOIN \`Contacto\` co ON co.\`campañaId\` = r.\`campañaId\` AND co.numero = r.numero
          LEFT JOIN \`Campaña\` c ON c.id = r.\`campañaId\`
          WHERE co.\`deudorId\` = ${id} AND r.\`enviadoAt\` IS NOT NULL
        `;
        parts.push(subWa);
      }

      // b) Email envíos
      if (!canal || canal === 'email') {
        const subEmailEnvios = Prisma.sql`
          SELECT
            CONCAT('email-', re.id) AS id,
            'email' AS canal,
            'envio' AS tipo,
            re.\`enviadoAt\` AS fecha,
            re.estado AS estado,
            re.asunto AS asunto,
            NULL AS mensaje,
            NULL AS templateNombre,
            re.error AS errorMsg,
            NULL AS urlDestino,
            ce.id AS campaniaId,
            ce.nombre AS campaniaNombre,
            co.id AS contactoId
          FROM \`ReporteEmail\` re
          INNER JOIN \`ContactoEmail\` co ON co.id = re.\`contactoId\`
          LEFT JOIN \`CampañaEmail\` ce ON ce.id = re.\`campañaId\`
          WHERE co.\`deudorId\` = ${id} AND re.\`enviadoAt\` IS NOT NULL
        `;
        parts.push(subEmailEnvios);

        // c) Email eventos
        const subEmailEventos = Prisma.sql`
          SELECT
            CONCAT('emailevt-', ev.id) AS id,
            'email' AS canal,
            LOWER(ev.tipo) AS tipo,
            ev.fecha AS fecha,
            'evento' AS estado,
            re.asunto AS asunto,
            NULL AS mensaje,
            NULL AS templateNombre,
            NULL AS errorMsg,
            ev.\`urlDestino\` AS urlDestino,
            ce.id AS campaniaId,
            ce.nombre AS campaniaNombre,
            co.id AS contactoId
          FROM \`EmailEvento\` ev
          INNER JOIN \`ReporteEmail\` re ON re.id = ev.\`reporteId\`
          INNER JOIN \`ContactoEmail\` co ON co.id = re.\`contactoId\`
          LEFT JOIN \`CampañaEmail\` ce ON ce.id = re.\`campañaId\`
          WHERE co.\`deudorId\` = ${id}
        `;
        parts.push(subEmailEventos);
      }

      // d) WAPI Meta
      if (!canal || canal === 'wapi') {
        const subWapi = Prisma.sql`
          SELECT
            CONCAT('wapi-', wr.id) AS id,
            'wapi' AS canal,
            'envio' AS tipo,
            wr.\`enviadoAt\` AS fecha,
            wr.estado AS estado,
            NULL AS asunto,
            NULL AS mensaje,
            wt.\`metaNombre\` AS templateNombre,
            wr.error AS errorMsg,
            NULL AS urlDestino,
            wc.id AS campaniaId,
            wc.nombre AS campaniaNombre,
            wco.id AS contactoId
          FROM \`WaApiReporte\` wr
          INNER JOIN \`WaApiContacto\` wco ON wco.id = wr.\`contactoId\`
          LEFT JOIN \`WaApiCampaña\` wc ON wc.id = wr.\`campañaId\`
          LEFT JOIN \`WaApiTemplate\` wt ON wt.id = wc.\`templateId\`
          WHERE wco.\`deudorId\` = ${id} AND wr.\`enviadoAt\` IS NOT NULL
        `;
        parts.push(subWapi);
      }

      // Si no hay ninguna subquery, retornar vacío
      if (parts.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          size,
          totalPages: 0,
        };
      }

      // UNION ALL de las subqueries
      const unionAll = Prisma.join(parts, ' UNION ALL ');

      // Construir WHERE dinámico para filtros de fecha
      const whereClauses: Prisma.Sql[] = [Prisma.sql`1=1`];
      if (desde) {
        whereClauses.push(Prisma.sql`t.fecha >= ${desde}`);
      }
      if (hasta) {
        whereClauses.push(Prisma.sql`t.fecha <= ${hasta}`);
      }
      const whereCondition = Prisma.join(whereClauses, ' AND ');

      // Query principal con paginación
      const rows = await this.prisma.$queryRaw<RawTimelineRow[]>`
        SELECT * FROM (${unionAll}) t
        WHERE ${whereCondition}
        ORDER BY t.fecha DESC
        LIMIT ${size} OFFSET ${page * size}
      `;

      // Query de total
      const totalResult = await this.prisma.$queryRaw<[{ total: bigint }]>`
        SELECT COUNT(*) as total FROM (${unionAll}) t
        WHERE ${whereCondition}
      `;

      const total = Number(totalResult[0]?.total || 0);
      const totalPages = Math.ceil(total / size);

      // Mapear a TimelineEntry
      const data: TimelineEntry[] = rows.map((row) => ({
        id: row.id,
        canal: row.canal as 'whatsapp' | 'email' | 'wapi',
        tipo: row.tipo,
        fecha: row.fecha,
        detalle: {
          asunto: row.asunto || undefined,
          mensaje: row.mensaje || undefined,
          templateNombre: row.templateNombre || undefined,
          estado: row.estado,
          error: row.errorMsg || undefined,
          urlDestino: row.urlDestino || undefined,
        },
        campaniaId: row.campaniaId,
        campaniaNombre: row.campaniaNombre,
        contactoId: row.contactoId,
      }));

      this.logger.log(
        `Timeline obtenida: ${data.length} entradas, total=${total}, página ${page + 1}/${totalPages}`,
      );

      return { data, total, page, size, totalPages };
    } catch (error) {
      // Re-lanzar excepciones de negocio
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Errores inesperados
      this.logger.error(
        `Error al obtener timeline del deudor id=${id}: ${error.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        'Error al obtener el timeline del deudor',
      );
    }
  }
}

/**
 * Type interno para el resultado raw de la query SQL del timeline
 */
type RawTimelineRow = {
  id: string;
  canal: string;
  tipo: string;
  fecha: Date;
  estado: string;
  asunto: string | null;
  mensaje: string | null;
  templateNombre: string | null;
  errorMsg: string | null;
  urlDestino: string | null;
  campaniaId: number | null;
  campaniaNombre: string | null;
  contactoId: number;
};

/**
 * Types internos para queries de reporte de empresas
 */
type RawEmpresaTotalesRow = {
  empresa: string;
  totalDeudores: bigint;
  contactosWa: bigint;
  contactosEmail: bigint;
  contactosWapi: bigint;
};

type RawEmpresaEnviosRow = {
  empresa: string;
  enviosWa: bigint;
};

type RawEmpresaEmailRow = {
  empresa: string;
  enviosEmail: bigint;
  entregadosEmail: bigint;
  abiertosEmail: bigint;
  clicksEmail: bigint;
};

type RawEmpresaRebotesRow = {
  empresa: string;
  rebotesEmail: bigint;
};

type RawEmpresaWapiRow = {
  empresa: string;
  enviosWapi: bigint;
  entregadosWapi: bigint;
  leidosWapi: bigint;
  fallidosWapi: bigint;
};

/**
 * Types internos para queries de reporte de remesas (agregan campo remesa)
 */
type RawRemesaTotalesRow = {
  empresa: string;
  remesa: string;
  totalDeudores: bigint;
  contactosWa: bigint;
  contactosEmail: bigint;
  contactosWapi: bigint;
};

type RawRemesaEnviosRow = {
  empresa: string;
  remesa: string;
  enviosWa: bigint;
};

type RawRemesaEmailRow = {
  empresa: string;
  remesa: string;
  enviosEmail: bigint;
  entregadosEmail: bigint;
  abiertosEmail: bigint;
  clicksEmail: bigint;
};

type RawRemesaRebotesRow = {
  empresa: string;
  remesa: string;
  rebotesEmail: bigint;
};

type RawRemesaWapiRow = {
  empresa: string;
  remesa: string;
  enviosWapi: bigint;
  entregadosWapi: bigint;
  leidosWapi: bigint;
  fallidosWapi: bigint;
};

/**
 * Helper para extracción case-insensitive de valores del rawRow
 */
class CaseInsensitiveHelper {
  private keyMap: Map<string, string>;

  constructor(private rawRow: Record<string, any>) {
    this.keyMap = new Map();
    for (const key of Object.keys(rawRow)) {
      this.keyMap.set(key.toLowerCase().trim(), key);
    }
  }

  /**
   * Busca el primer alias que matchee (case-insensitive) y retorna su valor como string
   */
  getString(aliases: string[]): string | null {
    for (const alias of aliases) {
      const actualKey = this.keyMap.get(alias.toLowerCase().trim());
      if (actualKey !== undefined) {
        const value = this.rawRow[actualKey];
        if (value !== null && value !== undefined && value !== '') {
          return String(value).trim();
        }
      }
    }
    return null;
  }

  /**
   * Busca el primer alias que matchee (case-insensitive) y retorna su valor como int
   */
  getInt(aliases: string[]): number | null {
    for (const alias of aliases) {
      const actualKey = this.keyMap.get(alias.toLowerCase().trim());
      if (actualKey !== undefined) {
        const value = this.rawRow[actualKey];
        if (value !== null && value !== undefined && value !== '') {
          const parsed = parseInt(String(value), 10);
          if (!isNaN(parsed)) {
            return parsed;
          }
        }
      }
    }
    return null;
  }

  /**
   * Retorna todas las keys originales del rawRow que matcheen alguno de los aliases
   */
  getAllMatchingKeys(aliases: string[]): string[] {
    const result: string[] = [];
    const aliasSet = new Set(aliases.map((a) => a.toLowerCase().trim()));

    for (const [keyLower, actualKey] of this.keyMap.entries()) {
      if (aliasSet.has(keyLower)) {
        result.push(actualKey);
      }
    }

    return result;
  }
}

/**
 * Type interno para la fila de exportación de actividades
 */
type RawDetalleRow = {
  idDeudor: number | null;
  nombre: string | null;
  documento: string | null;
  empresa: string | null;
  nroEmpresa: string | null;
  remesa: string | null;
  canal: string;
  tipo: string;
  destinatario: string;
  fecha: Date;
  estado: string;
  asunto: string | null;
  templateNombre: string | null;
  urlDestino: string | null;
  errorMsg: string | null;
  campaniaNombre: string | null;
};
