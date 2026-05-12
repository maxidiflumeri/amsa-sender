import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ManualEmailModule } from 'src/modules/email/manual-email/manual-email.module';
import { InternalEmailController } from './internal-email.controller';

@Module({
    imports: [PrismaModule, ManualEmailModule],
    controllers: [InternalEmailController],
})
export class InternalEmailModule { }
