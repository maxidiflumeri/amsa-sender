// src/modules/email/email.module.ts (o similar)
import { Module } from '@nestjs/common';
import { SesWebhookController } from './ses-webhook.controller';
import { SesWebhookService } from './ses-webhook.service';

@Module({
    controllers: [SesWebhookController],
    providers: [SesWebhookService],
})
export class SesWebhookModule { }