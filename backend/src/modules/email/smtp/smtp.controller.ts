import { Controller, Get, Post, Body, Param, UseGuards, Delete } from '@nestjs/common';
import { SmtpService } from './smtp.service';
import { CreateCuentaDto } from './dtos/create-cuenta.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso, SoloJwt } from 'src/auth/permisos.guard';

@Controller('email/cuentas')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequiredPermiso('email.cuentas_smtp')
export class SmtpController {
    constructor(private readonly smtpService: SmtpService) { }

    @Post()
    async crear(@Body() data: CreateCuentaDto) {
        return this.smtpService.crearCuenta(data);
    }

    @SoloJwt()
    @Get()
    async listar() {
        return this.smtpService.listarCuentas();
    }

    @Get(':id/test')
    async probarConexion(@Param('id') id: string) {
        return this.smtpService.probarConexion(Number(id));
    }

    @Get(':id/verificar-dominio')
    async verificarDominio(@Param('id') id: string) {
        return this.smtpService.verificarDominio(Number(id));
    }

    @Delete(':id')
    async eliminarCuenta(@Param('id') id: string) {
        return this.smtpService.eliminarCuenta(Number(id));
    }
}