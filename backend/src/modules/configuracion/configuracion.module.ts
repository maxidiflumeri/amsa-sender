import { Module } from '@nestjs/common';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionService } from './configuracion.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [AuthModule, PrismaModule],
    controllers: [ConfiguracionController],
    providers: [ConfiguracionService],
})

export class ConfiguracionModule { }
