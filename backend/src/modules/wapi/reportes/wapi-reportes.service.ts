import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from 'src/prisma/prisma.service';
import { WapiAnaliticaService } from '../analitica/wapi-analitica.service';

function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}

@Injectable()
export class WapiReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analiticaService: WapiAnaliticaService,
  ) {}

  async generarReporteCampaniaCSV(campañaId: number): Promise<Buffer> {
    const { data } = await this.analiticaService.contactosCampania(campañaId, 1, 999999, 'todos');

    const headers = [
      'numero', 'nombre', 'estado', 'enviadoAt', 'entregadoAt', 'leidoAt', 'error',
      'respondio', 'presionoBoton', 'dioDebaja',
    ];

    const lines: string[] = [headers.join(',')];
    for (const row of data) {
      const values = [
        row.numero,
        row.nombre ?? '',
        row.estado,
        formatDate(row.enviadoAt),
        formatDate(row.entregadoAt),
        formatDate(row.leidoAt),
        (row.error ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
        row.respondio ? 'Si' : 'No',
        row.presionoBoton ? 'Si' : 'No',
        row.dioDebaja ? 'Si' : 'No',
      ];
      lines.push(values.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }

    return Buffer.from('\uFEFF' + lines.join('\n'), 'utf-8');
  }

  async generarReporteCampaniaExcel(campañaId: number): Promise<Buffer> {
    const metricas = await this.analiticaService.metricasCampania(campañaId);
    const { data } = await this.analiticaService.contactosCampania(campañaId, 1, 999999, 'todos');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AMSA Sender';
    workbook.created = new Date();

    // Hoja 1: Resumen
    const sheetResumen = workbook.addWorksheet('Resumen');
    sheetResumen.columns = [
      { header: 'Métrica', key: 'metrica', width: 30 },
      { header: 'Valor', key: 'valor', width: 20 },
    ];
    sheetResumen.getRow(1).font = { bold: true };

    const kpis = [
      { metrica: 'Campaña', valor: metricas.campania.nombre },
      { metrica: 'Estado', valor: metricas.campania.estado },
      { metrica: 'Template', valor: metricas.campania.template?.metaNombre ?? '' },
      { metrica: 'Fecha envío', valor: formatDate(metricas.campania.enviadoAt) },
      { metrica: '', valor: '' },
      { metrica: 'Total contactos', valor: metricas.conteos.total },
      { metrica: 'Enviados', valor: metricas.conteos.enviados },
      { metrica: 'Entregados', valor: metricas.conteos.entregados },
      { metrica: 'Leídos', valor: metricas.conteos.leidos },
      { metrica: 'Fallidos', valor: metricas.conteos.fallidos },
      { metrica: 'Omitidos por baja', valor: metricas.conteos.omitidosPorBaja },
      { metrica: '', valor: '' },
      { metrica: 'Tasa de entrega (%)', valor: metricas.tasas.entrega },
      { metrica: 'Tasa de lectura (%)', valor: metricas.tasas.lectura },
      { metrica: 'Tasa de fallo (%)', valor: metricas.tasas.fallo },
      { metrica: '', valor: '' },
      { metrica: 'Respondieron', valor: metricas.engagement.respondieron },
      { metrica: 'Presionaron botón', valor: metricas.engagement.presionaronBoton },
      { metrica: 'Bajas', valor: metricas.engagement.bajas },
    ];
    sheetResumen.addRows(kpis);

    // Hoja 2: Contactos
    const sheetContactos = workbook.addWorksheet('Contactos');
    sheetContactos.columns = [
      { header: 'Número', key: 'numero', width: 20 },
      { header: 'Nombre', key: 'nombre', width: 25 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Enviado', key: 'enviadoAt', width: 22 },
      { header: 'Entregado', key: 'entregadoAt', width: 22 },
      { header: 'Leído', key: 'leidoAt', width: 22 },
      { header: 'Error', key: 'error', width: 40 },
      { header: 'Respondió', key: 'respondio', width: 12 },
      { header: 'Presionó botón', key: 'presionoBoton', width: 15 },
      { header: 'Baja', key: 'dioDebaja', width: 10 },
    ];
    sheetContactos.getRow(1).font = { bold: true };

    for (const row of data) {
      sheetContactos.addRow({
        numero: row.numero,
        nombre: row.nombre ?? '',
        estado: row.estado,
        enviadoAt: formatDate(row.enviadoAt),
        entregadoAt: formatDate(row.entregadoAt),
        leidoAt: formatDate(row.leidoAt),
        error: row.error ?? '',
        respondio: row.respondio ? 'Sí' : 'No',
        presionoBoton: row.presionoBoton ? 'Sí' : 'No',
        dioDebaja: row.dioDebaja ? 'Sí' : 'No',
      });
    }

    // Hoja 3: Errores
    const sheetErrores = workbook.addWorksheet('Errores');
    sheetErrores.columns = [
      { header: 'Error', key: 'error', width: 60 },
      { header: 'Cantidad', key: 'count', width: 12 },
    ];
    sheetErrores.getRow(1).font = { bold: true };
    metricas.errores.forEach(e => sheetErrores.addRow(e));

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generarReporteBajasCSV(): Promise<Buffer> {
    const bajas = await this.prisma.waApiBaja.findMany({
      orderBy: { creadoAt: 'desc' },
    });

    const headers = ['numero', 'campañaNombre', 'templateNombre', 'buttonPayload', 'confirmacionEnviada', 'creadoAt'];
    const lines: string[] = [headers.join(',')];

    for (const b of bajas) {
      const values = [
        b.numero,
        b.campañaNombre ?? '',
        b.templateNombre ?? '',
        b.buttonPayload ?? '',
        b.confirmacionEnviada ? 'Si' : 'No',
        formatDate(b.creadoAt),
      ];
      lines.push(values.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }

    return Buffer.from('\uFEFF' + lines.join('\n'), 'utf-8');
  }

  async generarReporteAgentesExcel(desde: Date, hasta: Date): Promise<Buffer> {
    const metricas = await this.analiticaService.metricasAgentes(desde, hasta);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AMSA Sender';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Agentes');
    sheet.columns = [
      { header: 'Nombre', key: 'nombre', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Asignadas', key: 'asignadas', width: 12 },
      { header: 'Resueltas', key: 'resueltas', width: 12 },
      { header: 'Activas', key: 'activas', width: 12 },
      { header: 'Mensajes enviados', key: 'mensajesEnviados', width: 18 },
      { header: 'Avg 1ra respuesta', key: 'avgPrimResp', width: 20 },
      { header: 'Avg resolución', key: 'avgResol', width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };

    function msToLegible(ms: number | null): string {
      if (!ms) return '—';
      const s = Math.floor(ms / 1000);
      if (s < 60) return `${s}s`;
      const m = Math.floor(s / 60);
      const rem = s % 60;
      if (m < 60) return `${m}m ${rem}s`;
      return `${Math.floor(m / 60)}h ${m % 60}m`;
    }

    metricas.agentes.forEach(a => {
      sheet.addRow({
        nombre: a.nombre,
        email: a.email,
        asignadas: a.asignadas,
        resueltas: a.resueltas,
        activas: a.activas,
        mensajesEnviados: a.mensajesEnviados,
        avgPrimResp: msToLegible(a.avgPrimeraRespuestaMs),
        avgResol: msToLegible(a.avgResolucionMs),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
