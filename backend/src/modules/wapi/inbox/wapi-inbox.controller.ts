import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';
import { WapiInboxService } from './wapi-inbox.service';

@Controller('wapi/inbox')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequiredPermiso('wapi.inbox')
export class WapiInboxController {
  constructor(private readonly inboxService: WapiInboxService) {}

  /** Conversaciones propias del asesor (o todas si es admin) */
  @Get()
  listar(@Req() req: any, @Query('configId') configId?: string) {
    const esAdmin = req['usuario']?.permisos?.includes('wapi.inbox.admin') ?? false;
    const configIdNum = configId ? parseInt(configId, 10) : undefined;
    return this.inboxService.listarConversaciones(req['usuario']?.sub, esAdmin, configIdNum);
  }

  /** Cola de conversaciones sin asignar — solo admin */
  @Get('sin-asignar')
  @RequiredPermiso('wapi.inbox.admin')
  listarSinAsignar(@Query('configId') configId?: string) {
    const configIdNum = configId ? parseInt(configId, 10) : undefined;
    return this.inboxService.listarSinAsignar(configIdNum);
  }

  @Get('buscar')
  buscar(@Query('q') q?: string, @Query('configId') configId?: string, @Req() req?: any) {
    const esAdmin = req['usuario']?.permisos?.includes('wapi.inbox.admin') ?? false;
    const configIdNum = configId ? parseInt(configId, 10) : undefined;
    return this.inboxService.buscar(q ?? '', req['usuario']?.sub, esAdmin, configIdNum);
  }

  @Get('resueltas')
  listarResueltas(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('configId') configId?: string,
    @Req() req?: any,
  ) {
    const esAdmin = req?.['usuario']?.permisos?.includes('wapi.inbox.admin') ?? false;
    const configIdNum = configId ? parseInt(configId, 10) : undefined;
    const pageNum = page ? parseInt(page, 10) : 0;
    const limitNum = limit ? Math.min(parseInt(limit, 10) || 25, 50) : 25;
    return this.inboxService.listarResueltas(req?.['usuario']?.sub, esAdmin, configIdNum, pageNum * limitNum, limitNum);
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.inboxService.obtenerConversacion(+id);
  }

  /** El asesor toma una conversación sin asignar para sí mismo */
  @Post(':id/tomar')
  tomar(@Param('id') id: string, @Req() req: any) {
    return this.inboxService.tomarConversacion(+id, req['usuario']?.sub);
  }

  /** Admin reasigna conversación a otro usuario */
  @Post(':id/asignar')
  @RequiredPermiso('wapi.inbox.admin')
  asignar(@Param('id') id: string, @Body() body: { userId: number }) {
    return this.inboxService.asignarConversacion(+id, body.userId);
  }

  @Post(':id/resolver')
  resolver(@Param('id') id: string, @Body() body: { nota?: string }, @Req() req: any) {
    return this.inboxService.resolverConversacion(+id, req['usuario']?.sub, body?.nota);
  }

  @Post(':id/marcar-leido')
  marcarLeido(@Param('id') id: string) {
    return this.inboxService.marcarLeido(+id);
  }

  @Post(':id/marcar-no-leido')
  marcarNoLeido(@Param('id') id: string) {
    return this.inboxService.marcarNoLeido(+id);
  }

  @Post(':id/mensajes')
  enviarMensaje(@Param('id') id: string, @Body() body: { texto: string }) {
    return this.inboxService.enviarMensaje(+id, body.texto);
  }

  @Post(':id/media')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
    }),
  }))
  enviarMedia(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption?: string,
  ) {
    return this.inboxService.enviarMedia(+id, file, caption);
  }

  @Get('media/:mediaId')
  async proxyMedia(@Param('mediaId') mediaId: string, @Res() res: Response) {
    await this.inboxService.proxyMedia(mediaId, res);
  }

  @Post(':id/ai/resumen')
  generarResumen(@Param('id') id: string) {
    return this.inboxService.generarResumen(+id);
  }

  @Post(':id/ai/sugerencia')
  generarSugerencia(@Param('id') id: string) {
    return this.inboxService.generarSugerencia(+id);
  }
}
