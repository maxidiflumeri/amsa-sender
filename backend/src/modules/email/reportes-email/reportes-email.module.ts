// src/email/engagement/engagement.module.ts
import { Module } from '@nestjs/common';
import { ReportesEmailController } from './reportes-email.controller';
import { ReportesEmailService } from './reportes-email.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [ReportesEmailController],
    providers: [ReportesEmailService],
    exports: [ReportesEmailService],
})
export class ReportesEmailModule { }
