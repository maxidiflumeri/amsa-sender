import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CrearWapiCampaniaDto {
  @IsString()
  nombre: string;

  @IsNumber()
  @Type(() => Number)
  templateId: number;

  @IsOptional()
  @IsObject()
  variableMapping?: Record<string, string>; // { "1": "columna_csv", "2": "otra_columna" }

  @IsOptional()
  @IsString()
  agendadoAt?: string; // ISO string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  delayMs?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  batchSize?: number;
}
