import {
    Controller,
    Post,
    Body,
    UseGuards,
    Get,
    Logger
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CampaniasEmailService } from './campanias-email.service';

@Controller('email/campanias')
@UseGuards(JwtAuthGuard)

export class CampaniasEmailController {
    private readonly logger = new Logger(CampaniasEmailController.name); // Corregido: antes usaba mal el nombre
    constructor(private readonly campaniasService: CampaniasEmailService) { }

    @Post()
    async crearCampaña(@Body() body: any) {
        this.logger.log(`📥 POST / - Crear campaña: ${body.nombre}`);
        return this.campaniasService.crearCampañaEmail(body);
    }

    @Get()
    async obtenerCampañas() {
        this.logger.log('📥 GET / - Obtener todas las campañas');
        return this.campaniasService.obtenerCampañas();
    }
}
