import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';
import { WapiReportesService } from './wapi-reportes.service';

@Controller('wapi/reportes')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequiredPermiso('wapi.analitica')
export class WapiReportesController {
  constructor(private readonly reportesService: WapiReportesService) {}

  @Get('campania/:id/csv')
  async csvCampania(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.reportesService.generarReporteCampaniaCSV(+id);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="campania-${id}.csv"`,
    });
    res.send(buffer);
  }

  @Get('campania/:id/excel')
  async excelCampania(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.reportesService.generarReporteCampaniaExcel(+id);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="campania-${id}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get('bajas/csv')
  async csvBajas(@Res() res: Response) {
    const buffer = await this.reportesService.generarReporteBajasCSV();
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="bajas.csv"',
    });
    res.send(buffer);
  }

  @Get('agentes/excel')
  async excelAgentes(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Res() res: Response,
  ) {
    const desdeDate = desde ? new Date(desde) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const hastaDate = hasta ? new Date(hasta) : new Date();
    const buffer = await this.reportesService.generarReporteAgentesExcel(desdeDate, hastaDate);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="agentes.xlsx"',
    });
    res.send(buffer);
  }
}
