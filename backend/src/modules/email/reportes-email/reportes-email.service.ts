// reportes-email.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailEventoTipo } from '@prisma/client';
import dayjs = require('dayjs');
import utc = require('dayjs/plugin/utc');
import timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const AR_TZ = 'America/Argentina/Buenos_Aires';


type TipoFiltro = 'open' | 'click' | 'all';

type OverviewParams = {
    since: Date;
    until: Date;
    q?: string;
    includeSparkline?: boolean;
    page: number;             // 0-based
    size: number;             // cards por página
};

type OverviewItem = {
    id: number;
    nombre: string;
    enviados: number;
    abiertosUnicos: number;
    clicsUnicos: number;
    tasaApertura: number;
    tasaClick: number;
    // si includeSparkline=true
    sparkline?: Array<{ day: string; abiertos: number; clics: number }>;
};

type OverviewResponse = {
    total: number;
    page: number;
    size: number;
    items: OverviewItem[];
};

@Injectable()
export class ReportesEmailService {
    constructor(private prisma: PrismaService) { }

    private fmtDate(d?: Date | null) {
        return d ? dayjs(d).format('YYYY-MM-DD HH:mm:ss.SSS') : '';
    }

    // Limpia saltos de línea y reemplaza ';' por ',' para no romper el CSV con separador ';'
    private clean(v?: string | null) {
        if (!v) return '';
        return String(v).replace(/[\r\n]+/g, ' ').replace(/;/g, ',').trim();
    }

    async overview(params: OverviewParams): Promise<OverviewResponse> {
        const { since, until, q, includeSparkline, page, size } = params;

        // --- Filtro de campañas (sin 'mode', rely en collation *_ci de MySQL) ---
        const whereCampaign = q ? { nombre: { contains: q } } : undefined;

        // --- Total y página de campañas (orden por createdAt desc) ---
        const [total, campañas] = await Promise.all([
            this.prisma.campañaEmail.count({ where: whereCampaign }),
            this.prisma.campañaEmail.findMany({
                where: whereCampaign,
                select: { id: true, nombre: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                skip: page * size,
                take: size,
            }),
        ]);

        if (campañas.length === 0) {
            return { total, page, size, items: [] };
        }

        const campañaIds = campañas.map((c) => c.id);

        // --- Enviados por campaña (estado='enviado'). Si preferís por enviadoAt en rango, ajustá el where ---
        const enviados = await this.prisma.reporteEmail.groupBy({
            by: ['campañaId'],
            where: {
                campañaId: { in: campañaIds },
                estado: 'enviado',
                // Si querés acotar por rango temporal del envío, usa enviadoAt:
                // enviadoAt: { gte: since, lt: until },
            },
            _count: { _all: true },
        });

        // --- Abiertos únicos por campaña (DISTINCT reporteId) en rango ---
        const abiertosUnicos = await this.prisma.$queryRaw<Array<{ campañaId: number; abiertos: bigint | number }>>(
            Prisma.sql`
            SELECT r.campañaId AS campañaId, COUNT(DISTINCT e.reporteId) AS abiertos
            FROM EmailEvento e
            JOIN ReporteEmail r ON r.id = e.reporteId
            WHERE e.tipo = 'OPEN'
              AND r.campañaId IN (${Prisma.join(campañaIds)})
              AND e.fecha >= ${since} AND e.fecha < ${until}
            GROUP BY r.campañaId
          `
        );

        // --- Clics únicos por campaña (DISTINCT reporteId) en rango ---
        const clicsUnicos = await this.prisma.$queryRaw<Array<{ campañaId: number; clics: bigint | number }>>(
            Prisma.sql`
            SELECT r.campañaId AS campañaId, COUNT(DISTINCT e.reporteId) AS clics
            FROM EmailEvento e
            JOIN ReporteEmail r ON r.id = e.reporteId
            WHERE e.tipo = 'CLICK'
              AND r.campañaId IN (${Prisma.join(campañaIds)})
              AND e.fecha >= ${since} AND e.fecha < ${until}
            GROUP BY r.campañaId
          `
        );

        // --- Sparkline (por día) opcional ---
        let sparkByCampaign: Record<number, Array<{ day: string; abiertos: number; clics: number }>> = {};
        if (includeSparkline) {
            const spark = await this.prisma.$queryRaw<
                Array<{ campañaId: number; day: string; abiertos: bigint | number; clics: bigint | number }>
            >(
                Prisma.sql`
              SELECT
                r.campañaId AS campañaId,
                DATE(e.fecha) AS day,
                SUM(CASE WHEN e.tipo='OPEN'  THEN 1 ELSE 0 END) AS abiertos,
                SUM(CASE WHEN e.tipo='CLICK' THEN 1 ELSE 0 END) AS clics
              FROM EmailEvento e
              JOIN ReporteEmail r ON r.id = e.reporteId
              WHERE r.campañaId IN (${Prisma.join(campañaIds)})
                AND e.fecha >= ${since} AND e.fecha < ${until}
              GROUP BY r.campañaId, DATE(e.fecha)
              ORDER BY day ASC
            `
            );

            sparkByCampaign = spark.reduce((acc, row) => {
                const cid = Number(row.campañaId);
                (acc[cid] ??= []).push({
                    day: row.day,
                    abiertos: Number(row.abiertos),
                    clics: Number(row.clics),
                });
                return acc;
            }, {} as Record<number, Array<{ day: string; abiertos: number; clics: number }>>);
        }

        // --- Mapas auxiliares para mergear resultados ---
        const enviadosMap = Object.fromEntries(enviados.map((e) => [e.campañaId, e._count._all]));
        const abiertosMap = Object.fromEntries(abiertosUnicos.map((a) => [Number(a.campañaId), Number(a.abiertos)]));
        const clicsMap = Object.fromEntries(clicsUnicos.map((c) => [Number(c.campañaId), Number(c.clics)]));

        // --- Construcción de items finales en el mismo orden de campañas ---
        const items: OverviewItem[] = campañas.map((c) => {
            const enviados = enviadosMap[c.id] ?? 0;
            const abiertos = abiertosMap[c.id] ?? 0;
            const clics = clicsMap[c.id] ?? 0;
            return {
                id: c.id,
                nombre: c.nombre,
                enviados,
                abiertosUnicos: abiertos,
                clicsUnicos: clics,
                tasaApertura: enviados ? abiertos / enviados : 0,
                tasaClick: enviados ? clics / enviados : 0,
                sparkline: includeSparkline ? (sparkByCampaign[c.id] ?? []) : undefined,
            };
        });

        return { total, page, size, items };
    }

    async campaignDetail(params: {
        campañaId: number;
        since: Date;
        until: Date;
        pageOpen: number;
        sizeOpen: number;
        pageClick: number;
        sizeClick: number;
        // ⬇️ NUEVO
        pageBounce: number;
        sizeBounce: number;
    }) {
        const { campañaId, since, until, pageOpen, sizeOpen, pageClick, sizeClick, pageBounce, sizeBounce } = params;

        // KPIs
        const enviados = await this.prisma.reporteEmail.count({
            where: { campañaId, estado: 'enviado' },
        });

        const [abiertosUnicos] = await this.prisma.$queryRaw<Array<{ abiertos: number }>>`
          SELECT COUNT(DISTINCT e.reporteId) AS abiertos
          FROM EmailEvento e
          JOIN ReporteEmail r ON r.id = e.reporteId
          WHERE e.tipo='OPEN' AND r.campañaId=${campañaId}
            AND e.fecha >= ${since} AND e.fecha < ${until}
        `;

        const [clicsUnicos] = await this.prisma.$queryRaw<Array<{ clics: number }>>`
          SELECT COUNT(DISTINCT e.reporteId) AS clics
          FROM EmailEvento e
          JOIN ReporteEmail r ON r.id = e.reporteId
          WHERE e.tipo='CLICK' AND r.campañaId=${campañaId}
            AND e.fecha >= ${since} AND e.fecha < ${until}
        `;

        const rebotes = await this.prisma.emailRebote.count({
            where: {
                reporte: { campañaId },
                fecha: { gte: since, lt: until },
            },
        });

        const primeroAbierto = await this.prisma.emailEvento.findFirst({
            where: { reporte: { campañaId }, tipo: 'OPEN', fecha: { gte: since, lt: until } },
            orderBy: { fecha: 'asc' },
            select: { fecha: true },
        });

        const primeroClick = await this.prisma.emailEvento.findFirst({
            where: { reporte: { campañaId }, tipo: 'CLICK', fecha: { gte: since, lt: until } },
            orderBy: { fecha: 'asc' },
            select: { fecha: true },
        });

        // Listado paginado de aperturas
        const [aperturas, totalAperturas] = await Promise.all([
            this.prisma.emailEvento.findMany({
                where: { reporte: { campañaId }, tipo: 'OPEN', fecha: { gte: since, lt: until } },
                orderBy: { fecha: 'desc' },
                skip: pageOpen * sizeOpen,
                take: sizeOpen,
                select: {
                    id: true, fecha: true, ip: true, userAgent: true, deviceFamily: true, osName: true, browserName: true,
                    reporte: { select: { contacto: { select: { email: true } } } },
                },
            }),
            this.prisma.emailEvento.count({
                where: { reporte: { campañaId }, tipo: 'OPEN', fecha: { gte: since, lt: until } },
            }),
        ]);

        // Listado paginado de clicks
        const [clicks, totalClicks] = await Promise.all([
            this.prisma.emailEvento.findMany({
                where: { reporte: { campañaId }, tipo: 'CLICK', fecha: { gte: since, lt: until } },
                orderBy: { fecha: 'desc' },
                skip: pageClick * sizeClick,
                take: sizeClick,
                select: {
                    id: true, fecha: true, ip: true, userAgent: true, urlDestino: true, dominioDestino: true,
                    reporte: { select: { contacto: { select: { email: true } } } },
                },
            }),
            this.prisma.emailEvento.count({
                where: { reporte: { campañaId }, tipo: 'CLICK', fecha: { gte: since, lt: until } },
            }),
        ]);

        const [rebotesList, totalRebotes] = await Promise.all([
            this.prisma.emailRebote.findMany({
                where: { reporte: { campañaId }, fecha: { gte: since, lt: until } },
                orderBy: { fecha: 'desc' },
                skip: pageBounce * sizeBounce,
                take: sizeBounce,
                select: {
                    id: true,
                    fecha: true,
                    codigo: true,
                    descripcion: true,
                    correo: true,
                    reporte: { select: { contacto: { select: { email: true } } } },
                },
            }),
            this.prisma.emailRebote.count({
                where: { reporte: { campañaId }, fecha: { gte: since, lt: until } },
            }),
        ]);

        return {
            resumen: {
                enviados,
                abiertosUnicos: Number(abiertosUnicos?.abiertos ?? 0),
                clicsUnicos: Number(clicsUnicos?.clics ?? 0),
                rebotes,
                primeroAbierto: primeroAbierto?.fecha ?? null,
                primeroClick: primeroClick?.fecha ?? null,
            },
            aperturas: aperturas.map(e => ({
                id: e.id,
                timestamp: e.fecha.toISOString(),
                email: e.reporte.contacto.email,
                ip: e.ip ?? undefined,
                userAgent: e.userAgent ?? undefined,
                deviceFamily: e.deviceFamily ?? undefined,
                osName: e.osName ?? undefined,
                browserName: e.browserName ?? undefined,
            })),
            clicks: clicks.map(e => ({
                id: e.id,
                timestamp: e.fecha.toISOString(),
                email: e.reporte.contacto.email,
                url: e.urlDestino ?? '',
                dominio: e.dominioDestino ?? undefined,
                ip: e.ip ?? undefined,
                userAgent: e.userAgent ?? undefined,
            })),
            rebotes: rebotesList.map(r => ({
                id: r.id,
                timestamp: r.fecha.toISOString(),
                // preferimos el correo que realmente rebotó; si no está, fallback al del contacto
                email: r.correo ?? r.reporte?.contacto?.email ?? '',
                codigo: r.codigo ?? undefined,
                descripcion: r.descripcion ?? undefined,
            })),
            totalAperturas,
            totalClicks,
            totalRebotes
        };
    }

    /**
  * Eventos por fecha (si no viene date => hoy en AR_TZ)
  * @param params.date YYYY-MM-DD (opcional)
  * @param params.limit cantidad máxima (default 200)
  * @param params.afterId paginación incremental por id
  */
    async eventsByDate(params: { date?: string; limit?: number; afterId?: number }) {
        const { date, afterId } = params || {};
        const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500000); // guarda

        // Si viene YYYY-MM-DD válido, usamos esa fecha; si no, "hoy" en AR_TZ
        const base = (date && /^\d{4}-\d{2}-\d{2}$/.test(date))
            ? dayjs.tz(date, AR_TZ)
            : dayjs.tz(undefined, AR_TZ);

        // Rango del día: [00:00:00.000, siguiente día 00:00) en AR_TZ
        const start = base.startOf('day');
        const end = start.add(1, 'day');

        const whereBase: any = {
            fecha: {
                gte: start.toDate(),
                lt: end.toDate(), // end exclusivo para evitar problemas de milisegundos
            },
        };
        if (afterId) whereBase.id = { gt: afterId };

        const events = await this.prisma.emailEvento.findMany({
            where: whereBase,
            orderBy: { id: 'asc' },   // id asc para streaming incremental
            take: limit,
            select: {
                id: true,
                tipo: true,
                fecha: true,
                urlDestino: true,
                dominioDestino: true,
                reporte: {
                    select: {
                        campañaId: true,
                        campaña: { select: { nombre: true } },
                        contacto: { select: { email: true } },
                    },
                },
            },
        });

        return events.map(e => ({
            id: e.id,
            tipo: e.tipo,
            timestamp: e.fecha.toISOString(),
            campañaId: e.reporte.campañaId,
            campañaNombre: e.reporte.campaña?.nombre ?? `Campaña ${e.reporte.campañaId}`,
            email: e.reporte.contacto.email,
            url: e.urlDestino ?? undefined,
            dominio: e.dominioDestino ?? undefined,
        }));
    }

    /**
       * Genera CSV de aperturas y clicks con los encabezados exactos requeridos.
       * Filtros opcionales:
       * - campaniaId?: number
       * - desde?: Date (filtra por FECHA_ACTIVIDAD)
       * - hasta?: Date
       * - tipo?: 'open' | 'click' | 'all'
       *
       * Devuelve string CSV listo para descargar.
       */
    async generarCsvActividades(params: {
        campaniaId?: number;
        desde?: Date;
        hasta?: Date;
        tipo?: TipoFiltro;
    }): Promise<string> {
        const { campaniaId, desde, hasta, tipo = 'all' } = params;        

        // Construyo el where para EmailEvento
        const where: any = {
            ...(desde || hasta
                ? { fecha: { gte: desde ?? undefined, lte: hasta ?? undefined } }
                : {}),
            ...(tipo !== 'all'
                ? {
                    tipo:
                        tipo === 'open' ? EmailEventoTipo.OPEN : EmailEventoTipo.CLICK,
                }
                : {}),
            // Filtro por campaña a través del reporte
            reporte: campaniaId ? { campaniaId } : undefined,
        };

        const eventos = await this.prisma.emailEvento.findMany({
            where,
            include: {
                reporte: {
                    select: {
                        id: true,
                        enviadoAt: true,
                        campaña: { select: { id: true, nombre: true } },
                        contacto: {
                            select: {
                                id: true,
                                email: true,
                                datos: true // 👈 agregamos el JSON
                            }
                        },
                    },
                },
            },
            orderBy: { fecha: 'asc' },
        });

        const header =
            'EMAIL;FECHA_ENVIO;FECHA_ACTIVIDAD;CAMPANIA;ACCION;TIPO_ACCION;ACTIVIDAD;DESCRIPCION;ID_CONTACTO';
        const rows: string[] = [header];

        for (const e of eventos) {
            const EMAIL = this.clean(e.reporte?.contacto?.email);
            const FECHA_ENVIO = this.fmtDate(e.reporte?.enviadoAt);
            const FECHA_ACTIVIDAD = this.fmtDate(e.fecha);
            const CAMPANIA = this.clean(e.reporte?.campaña?.nombre);

            // No existen en tu schema → vacío
            const ACCION = '';
            const TIPO_ACCION = 'Envio simple';

            const ACTIVIDAD =
                e.tipo === EmailEventoTipo.OPEN
                    ? 'Abierto'
                    : e.tipo === EmailEventoTipo.CLICK
                        ? 'Click'
                        : '';

            // DESCRIPCION: para OPEN usamos deviceFamily (Desktop/Mobile/Tablet/…)
            // para CLICK priorizamos la URL clickeada (si no, dominio)
            let descripcion = '';
            if (e.tipo === EmailEventoTipo.OPEN) {
                descripcion = this.clean(e.deviceFamily);
            } else if (e.tipo === EmailEventoTipo.CLICK) {
                descripcion = this.clean(e.urlDestino || e.dominioDestino);
            }

            // 👇 obtenemos ID_CONTACTO desde contacto.datos
            let ID_CONTACTO = '';
            try {
                const datos = e.reporte?.contacto?.datos as any;
                if (datos && typeof datos === 'object' && 'id_contacto' in datos) {
                    ID_CONTACTO = String(datos['id_contacto']);
                }
            } catch (err) {
                ID_CONTACTO = '';
            }

            rows.push(
                [
                    EMAIL,
                    FECHA_ENVIO,
                    FECHA_ACTIVIDAD,
                    CAMPANIA,
                    ACCION,
                    TIPO_ACCION,
                    ACTIVIDAD,
                    descripcion,
                    ID_CONTACTO,
                ].join(';'),
            );
        }

        // Fin de línea con CRLF para máxima compatibilidad (Excel, etc.)
        return rows.join('\r\n') + '\r\n';
    }

    /**
 * Rebotes por fecha (si no viene date => hoy en AR_TZ)
 * @param params.date YYYY-MM-DD (opcional)
 * @param params.limit cantidad máxima (default 200)
 * @param params.afterId paginación incremental por id
 */
    async rebotesByDate(params: { date?: string; limit?: number; afterId?: number }) {
        const { date, afterId } = params || {};
        const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500000);

        // Si viene YYYY-MM-DD válido, usamos esa fecha; si no, "hoy" en AR_TZ
        const base = (date && /^\d{4}-\d{2}-\d{2}$/.test(date))
            ? dayjs.tz(date, AR_TZ)
            : dayjs.tz(undefined, AR_TZ);

        // Rango del día: [00:00:00.000, 00:00 del día siguiente) en AR_TZ
        const start = base.startOf('day');
        const end = start.add(1, 'day');

        const whereBase: any = {
            fecha: {
                gte: start.toDate(),
                lt: end.toDate(),
            },
        };
        if (afterId) whereBase.id = { gt: afterId };

        const rebotes = await this.prisma.emailRebote.findMany({
            where: whereBase,
            orderBy: { id: 'asc' },
            take: limit,
            select: {
                id: true,
                fecha: true,
                codigo: true,
                descripcion: true,
                correo: true,
                reporteId: true,
                reporte: {
                    select: {
                        id: true,
                        enviadoAt: true,
                        creadoAt: true,
                        campañaId: true,
                        campaña: { select: { nombre: true } },
                        contacto: { select: { id: true, email: true } },
                    },
                },
            },
        });

        return rebotes.map(r => ({
            id: r.id,
            timestamp: r.fecha.toISOString(),                              // FECHA_ACTIVIDAD
            email: r.correo ?? r.reporte?.contacto?.email ?? '',
            codigo: r.codigo ?? undefined,
            descripcion: r.descripcion ?? undefined,
            campañaId: r.reporte?.campañaId,
            campañaNombre: r.reporte?.campaña?.nombre ?? (r.reporte?.campañaId ? `Campaña ${r.reporte.campañaId}` : undefined),
            idContacto: r.reporte?.contacto?.id,
            reporteId: r.reporteId ?? undefined,
            enviadoAt: r.reporte?.enviadoAt ?? r.reporte?.creadoAt ?? null, // por si querés mostrarla en UI
        }));
    }

    /**
 * Genera CSV de rebotes con los encabezados exactos requeridos.
 * Filtros opcionales:
 * - campaniaId?: number
 * - desde?: Date (filtra por FECHA_ACTIVIDAD = fecha del rebote)
 * - hasta?: Date
 *
 * Devuelve string CSV listo para descargar (separado por ';').
 */
    async generarCsvRebotes(params: {
        campaniaId?: number;
        desde?: Date;
        hasta?: Date;
    }): Promise<string> {
        const { campaniaId, desde, hasta } = params;        
        const where: any = {
            ...(desde || hasta ? { fecha: { gte: desde ?? undefined, lte: hasta ?? undefined } } : {}),
            ...(campaniaId ? { reporte: { campañaId: campaniaId } } : {}),
        };

        const rebotes = await this.prisma.emailRebote.findMany({
            where,
            include: {
                reporte: {
                    select: {
                        id: true,
                        enviadoAt: true,
                        creadoAt: true,
                        campaña: { select: { id: true, nombre: true } },
                        contacto: { select: { id: true, email: true } },
                    },
                },
            },
            orderBy: { fecha: 'asc' },
        });

        const header =
            'EMAIL;FECHA_ENVIO;FECHA_ACTIVIDAD;CAMPANIA;ACCION;TIPO_ACCION;ACTIVIDAD;DESCRIPCION;ID_CONTACTO';
        const rows: string[] = [header];

        for (const r of rebotes) {
            // EMAIL: primero el que detectamos en el rebote; sino, el del contacto del reporte
            const EMAIL = this.clean(r.correo ?? r.reporte?.contacto?.email);

            // FECHA_ENVIO: del reporte (fallback creadoAt si enviadoAt nulo)
            const FECHA_ENVIO = this.fmtDate(r.reporte?.enviadoAt ?? r.reporte?.creadoAt);

            // FECHA_ACTIVIDAD: fecha del rebote
            const FECHA_ACTIVIDAD = this.fmtDate(r.fecha);

            // CAMPANIA: nombre (fallback al id)
            const CAMPANIA = this.clean(r.reporte?.campaña?.nombre ?? (r.reporte?.campaña?.id ? `Campaña #${r.reporte.campaña.id}` : ''));

            // ACCION: en tu schema no existe un campo específico → lo dejamos vacío (como haces en actividades)
            const ACCION = '';

            // TIPO_ACCION: fijo como en el ejemplo
            const TIPO_ACCION = 'Envio simple';

            // ACTIVIDAD: fijo
            const ACTIVIDAD = 'Rebote';

            // DESCRIPCION: "codigo - descripcion" (si ambos), sino uno u otro
            const DESCRIPCION =
                r.codigo && r.descripcion ? `${this.clean(r.codigo)} - ${this.clean(r.descripcion)}` :
                    r.codigo ? this.clean(r.codigo) :
                        this.clean(r.descripcion);

            // ID_CONTACTO: del reporte
            const ID_CONTACTO = r.reporte?.contacto?.id !== undefined ? String(r.reporte.contacto.id) : '';

            rows.push([
                EMAIL,
                FECHA_ENVIO,
                FECHA_ACTIVIDAD,
                CAMPANIA,
                ACCION,
                TIPO_ACCION,
                ACTIVIDAD,
                DESCRIPCION,
                ID_CONTACTO,
            ].join(';'));
        }

        // CRLF para compatibilidad con Excel
        return rows.join('\r\n') + '\r\n';
    }
}