import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { EmailDesuscribirModule } from 'src/modules/email/desuscribir-email/desuscribir-email.module';
import { ManualEmailService } from './manual-email.service';
import { ManualEmailController } from './manual-email.controller';

@Module({
    imports: [PrismaModule, AuthModule, EmailDesuscribirModule],
    providers: [ManualEmailService],
    controllers: [ManualEmailController],
})
export class ManualEmailModule { }
