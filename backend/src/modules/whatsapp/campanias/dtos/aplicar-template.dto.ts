import { IsNotEmpty, IsNumber } from 'class-validator';

export class AplicarTemplateDto {
    @IsNotEmpty()
    @IsNumber()
    templateId: number;
}