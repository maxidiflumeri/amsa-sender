// src/modules/email/email.module.ts (o similar)
import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SesWebhookController } from './ses-webhook.controller';
import { SesWebhookService } from './ses-webhook.service';

@Module({
    controllers: [SesWebhookController],
    providers: [PrismaService, SesWebhookService],
})
export class SesWebhookModule { }