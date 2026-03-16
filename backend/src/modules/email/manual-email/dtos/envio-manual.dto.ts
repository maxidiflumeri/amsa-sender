export class EnvioManualDto {
    to: string;
    toNombre?: string;
    smtpId: number;
    subject: string;
    html: string;
    templateId?: number;
    variables?: Record<string, string>;
}
