// dto/update-template-email.dto.ts
import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateTemplateEmailDto {
    @IsOptional()
    @IsString()
    nombre?: string;

    @IsOptional()
    @IsString()
    asunto?: string;

    @IsOptional()
    @IsString()
    html?: string;

    @IsOptional()
    @IsInt()
    cuentaSmtpId?: number | null;
}