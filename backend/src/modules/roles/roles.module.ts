import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
    imports: [PrismaModule, AuthModule],
    providers: [RolesService],
    controllers: [RolesController],
})
export class RolesModule {}
