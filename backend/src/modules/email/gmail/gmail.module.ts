// src/gmail/gmail.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
    imports: [ScheduleModule.forRoot(), AuthModule],
    providers: [GmailService, PrismaService],
    controllers: [GmailController],
    exports: [GmailService],
})
export class GmailModule { }