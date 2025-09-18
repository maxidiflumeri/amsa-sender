import {
    Controller,
    Post,
    Req,
    Res,
    Headers,
    HttpCode,
    Logger,
    Body,
} from '@nestjs/common';
import { Response } from 'express';
import { SesWebhookService } from './ses-webhook.service';

@Controller('email/ses')
export class SesWebhookController {
    private readonly logger = new Logger(SesWebhookController.name);

    constructor(private readonly svc: SesWebhookService) { }

    @Post('webhook')
    @HttpCode(200)
    async handle(
        @Headers() headers: Record<string, string>,
        @Body() rawBody: string,           // 👈 llega como TEXTO
        @Res() res: Response,
    ) {
        const msgType = headers['x-amz-sns-message-type'];
        
        // 0) Parsear el texto a JSON
        let payload: any;
        try {
            payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
        } catch (e) {
            this.logger.warn('Invalid SNS body (cannot parse JSON)');
            return res.status(400).end();
        }        

        // 1) Validar firma SNS
        const ok = await this.svc.validateSnsSignature(payload);
        if (!ok) return res.status(400).end();

        // 2) TopicArn esperado
        const expected = process.env.SES_SNS_TOPIC_ARN;
        if (expected && payload.TopicArn !== expected) {
            this.logger.warn(`Unexpected TopicArn: ${payload.TopicArn}`);
            return res.status(400).end();
        }

        // 3) Flujos de SNS
        if (msgType === 'SubscriptionConfirmation') {
            const success = await this.svc.confirmSubscription(payload.SubscribeURL);
            return success ? res.end() : res.status(500).end();
        }
        if (msgType === 'UnsubscribeConfirmation') return res.end();
        if (msgType !== 'Notification') return res.status(400).end();

        // 4) Notificación SES
        const handled = await this.svc.processNotification(payload);
        return handled ? res.end() : res.status(400).end();
    }
}  