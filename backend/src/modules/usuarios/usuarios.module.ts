import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';

@Module({
    imports: [PrismaModule, AuthModule],
    providers: [UsuariosService],
    controllers: [UsuariosController],
})
export class UsuariosModule {}
