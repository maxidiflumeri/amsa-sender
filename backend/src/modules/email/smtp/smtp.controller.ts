import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { SmtpService } from './smtp.service';
import { CreateCuentaDto } from './dtos/create-cuenta.dto';

@Controller('email/cuentas')
export class SmtpController {
    constructor(private readonly smtpService: SmtpService) { }

    @Post()
    async crear(@Body() data: CreateCuentaDto) {
        return this.smtpService.crearCuenta(data);
    }

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
}