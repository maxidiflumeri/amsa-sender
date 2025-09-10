export class CreateUnsubscribeDto {
    email: string;
    scope?: 'global' | 'campaign';
    campaignId?: string;
    reason?: string;
    source?: string;
}