import { IsNotEmpty, IsString, IsIn, IsOptional, IsISO8601 } from 'class-validator';

export class ExportarReporteDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['empresa', 'remesa'])
  tipo: 'empresa' | 'remesa';

  @IsNotEmpty()
  @IsString()
  @IsIn(['csv', 'xlsx'])
  formato: 'csv' | 'xlsx';

  @IsOptional()
  @IsString()
  empresa?: string;

  @IsOptional()
  @IsISO8601()
  desde?: string;

  @IsOptional()
  @IsISO8601()
  hasta?: string;
}
