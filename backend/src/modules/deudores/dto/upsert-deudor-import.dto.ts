import { IsInt, IsOptional, IsString, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertDeudorImportDto {
  @IsInt()
  idDeudor: number;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  documento?: string;

  @IsOptional()
  @IsString()
  nroEmpresa?: string;

  @IsOptional()
  @IsString()
  empresa?: string;

  @IsOptional()
  @IsString()
  remesa?: string;

  @IsOptional()
  @IsObject()
  datos?: Record<string, any>;
}
