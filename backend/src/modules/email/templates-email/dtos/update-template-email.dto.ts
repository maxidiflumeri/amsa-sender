// dto/update-template-email.dto.ts
import { IsOptional, IsString } from 'class-validator';

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
}