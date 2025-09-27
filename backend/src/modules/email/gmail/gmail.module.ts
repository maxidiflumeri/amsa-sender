// src/gmail/gmail.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [ScheduleModule.forRoot(), AuthModule],
    providers: [GmailService],
    controllers: [GmailController],
    exports: [GmailService],
})
export class GmailModule { }