import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { PermisosGuard, RequiredPermiso } from 'src/auth/permisos.guard';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, PermisosGuard)
@RequiredPermiso('admin.usuarios')
export class UsuariosController {
    constructor(private readonly usuariosService: UsuariosService) {}

    @Get()
    findAll() {
        return this.usuariosService.findAll();
    }

    @Post()
    create(@Body() body: { email: string; nombre: string; rolId: number }) {
        return this.usuariosService.create(body);
    }

    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { nombre?: string; rolId?: number; activo?: boolean },
    ) {
        return this.usuariosService.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
        return this.usuariosService.remove(id, req['usuario']?.sub);
    }
}
