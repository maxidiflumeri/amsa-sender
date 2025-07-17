import { IsInt, IsString, IsObject } from 'class-validator';

export class GuardarConfiguracionDto {
    @IsInt()
    userId: number;

    @IsString()
    scope: string;

    @IsObject()
    valores: Record<string, string | number | boolean>;
}