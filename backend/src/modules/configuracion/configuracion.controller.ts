import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ConfiguracionService } from "./configuracion.service";
import { GuardarConfiguracionDto } from "./dto/guardar-config.dto";
import { JwtAuthGuard } from "src/auth/jwt-auth.guard";

@UseGuards(JwtAuthGuard)
@Controller('config')
export class ConfiguracionController {
    constructor(private readonly configService: ConfiguracionService) { }

    @Post()
    guardar(@Body() dto: GuardarConfiguracionDto) {
        return this.configService.guardar(dto);
    }

    @Get()
    obtener(
        @Query('scope') scope: string,
    ) {
        return this.configService.obtener(scope);
    }
}
