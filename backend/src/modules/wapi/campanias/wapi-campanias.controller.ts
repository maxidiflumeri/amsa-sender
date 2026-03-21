import {
  BadRequestException, Body, Controller, Delete, Get,
  Param, Post, Req, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';
import { WapiCampaniasService } from './wapi-campanias.service';
import { CrearWapiCampaniaDto } from './dtos/crear-wapi-campania.dto';

@Controller('wapi/campanias')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequiredPermiso('wapi.campanias')
export class WapiCampaniasController {
  constructor(private readonly wapiCampaniasService: WapiCampaniasService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
      }),
    }),
  )
  async crear(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Archivo CSV requerido.');
    const dto: CrearWapiCampaniaDto = {
      nombre: body.nombre,
      templateId: Number(body.templateId),
      variableMapping: body.variableMapping
        ? (typeof body.variableMapping === 'string' ? JSON.parse(body.variableMapping) : body.variableMapping)
        : undefined,
      delayMs: body.delayMs ? Number(body.delayMs) : undefined,
      batchSize: body.batchSize ? Number(body.batchSize) : undefined,
      agendadoAt: body.agendadoAt,
    };
    return this.wapiCampaniasService.crearCampania(dto, file.path, req['usuario']?.sub);
  }

  @Get()
  listar() {
    return this.wapiCampaniasService.listarCampanias();
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.wapiCampaniasService.obtenerCampania(+id);
  }

  @Get(':id/reportes')
  reportes(@Param('id') id: string) {
    return this.wapiCampaniasService.obtenerReportes(+id);
  }

  @Post(':id/enviar')
  enviar(@Param('id') id: string) {
    return this.wapiCampaniasService.enviarCampania(+id);
  }

  @Post(':id/agendar')
  agendar(@Param('id') id: string, @Body() body: { agendadoAt: string }) {
    return this.wapiCampaniasService.agendarCampania(+id, body.agendadoAt);
  }

  @Post(':id/pausar')
  pausar(@Param('id') id: string) {
    return this.wapiCampaniasService.pausarCampania(+id);
  }

  @Post(':id/forzar-cierre')
  forzarCierre(@Param('id') id: string, @Body() body: { estado: 'finalizada' | 'error' }) {
    return this.wapiCampaniasService.forzarCierre(+id, body.estado ?? 'error');
  }

  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.wapiCampaniasService.eliminarCampania(+id);
  }
}
