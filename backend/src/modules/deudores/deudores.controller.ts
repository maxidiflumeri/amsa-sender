import { Controller, Get, Query, Param, ParseIntPipe, UseGuards, UsePipes, ValidationPipe, Res } from '@nestjs/common';
import { Response } from 'express';
import { DeudoresService } from './deudores.service';
import { BuscarDeudoresDto } from './dto/buscar-deudores.dto';
import { TimelineQueryDto } from './dto/timeline-query.dto';
import { ReporteQueryDto } from './dto/reporte-query.dto';
import { ExportarReporteDto } from './dto/exportar-reporte.dto';
import { ExportarDetalleDto } from './dto/exportar-detalle.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';
import { DeudorFicha } from './interfaces/timeline.interface';

@Controller('deudores')
@UseGuards(JwtAuthGuard, PermisosGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class DeudoresController {
  constructor(private readonly deudoresService: DeudoresService) {}

  /**
   * Buscar deudores con filtros y paginación
   * GET /api/deudores/buscar?q=...&empresa=...&nroEmpresa=...&remesa=...&page=0&size=20
   */
  @Get('buscar')
  @RequiredPermiso('deudores.ver')
  async buscar(@Query() dto: BuscarDeudoresDto) {
    return this.deudoresService.buscar(dto);
  }

  /**
   * Obtener lista de empresas únicas
   * GET /api/deudores/empresas
   */
  @Get('empresas')
  @RequiredPermiso('deudores.ver')
  async empresas() {
    return this.deudoresService.obtenerEmpresas();
  }

  /**
   * Obtener empresas presentes en DB que no están mapeadas en EMPRESAS_MAP.
   * Útil para detectar IDs nuevos que hay que agregar al archivo de constantes.
   * GET /api/deudores/empresas/no-mapeadas
   */
  @Get('empresas/no-mapeadas')
  @RequiredPermiso('deudores.reportes')
  async empresasNoMapeadas() {
    return this.deudoresService.obtenerEmpresasNoMapeadas();
  }

  /**
   * Obtener lista de remesas únicas (opcionalmente filtradas por una o varias empresas)
   * GET /api/deudores/remesas?empresas=A,B,C
   */
  @Get('remesas')
  @RequiredPermiso('deudores.ver')
  async remesas(@Query('empresas') empresas?: string) {
    const arr = empresas
      ? empresas.split(',').map((v) => v.trim()).filter(Boolean)
      : undefined;
    return this.deudoresService.obtenerRemesas(arr);
  }

  /**
   * Exportar detalle de actividades (fila por actividad) a CSV o XLSX
   * GET /api/deudores/reportes/exportar-detalle?formato=csv|xlsx&empresa=...&remesa=...&desde=...&hasta=...&canal=...
   */
  @Get('reportes/exportar-detalle')
  @RequiredPermiso('deudores.reportes')
  async exportarDetalle(
    @Query() query: ExportarDetalleDto,
    @Res() res: Response,
  ) {
    const { buffer, filename, contentType } = await this.deudoresService.exportarDetalle(query);
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  /**
   * Exportar reporte de deudores a CSV o XLSX
   * GET /api/deudores/reportes/exportar?tipo=empresa|remesa&formato=csv|xlsx&empresa=...&desde=...&hasta=...
   */
  @Get('reportes/exportar')
  @RequiredPermiso('deudores.reportes')
  async exportarReporte(
    @Query() query: ExportarReporteDto,
    @Res() res: Response,
  ) {
    const { buffer, filename, contentType } = await this.deudoresService.exportarReporte(query);
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  /**
   * Obtener reporte agregado por empresas
   * GET /api/deudores/reportes/empresas?empresa=...&desde=...&hasta=...&page=0&size=20
   */
  @Get('reportes/empresas')
  @RequiredPermiso('deudores.reportes')
  async reporteEmpresas(@Query() query: ReporteQueryDto) {
    return this.deudoresService.obtenerReporteEmpresas(query);
  }

  /**
   * Obtener reporte agregado por remesas
   * GET /api/deudores/reportes/remesas?empresa=...&desde=...&hasta=...&page=0&size=20
   */
  @Get('reportes/remesas')
  @RequiredPermiso('deudores.reportes')
  async reporteRemesas(@Query() query: ReporteQueryDto) {
    return this.deudoresService.obtenerReporteRemesas(query);
  }

  /**
   * Obtener ficha individual de un deudor por ID
   * GET /api/deudores/:id
   */
  @Get(':id')
  @RequiredPermiso('deudores.ver')
  async obtenerPorId(@Param('id', ParseIntPipe) id: number): Promise<DeudorFicha> {
    return this.deudoresService.obtenerPorId(id);
  }

  /**
   * Obtener timeline de interacciones del deudor
   * GET /api/deudores/:id/timeline?page=0&size=30&canal=...&desde=...&hasta=...
   */
  @Get(':id/timeline')
  @RequiredPermiso('deudores.ver')
  async timeline(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: TimelineQueryDto,
  ) {
    return this.deudoresService.obtenerTimeline(id, query);
  }
}
