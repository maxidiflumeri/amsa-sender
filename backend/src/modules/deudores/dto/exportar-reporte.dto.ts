import { IsNotEmpty, IsString, IsIn, IsOptional, IsISO8601, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

const toStringArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    const filtered = value
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      .map((v) => v.trim());
    return filtered.length > 0 ? filtered : undefined;
  }
  if (typeof value === 'string') {
    const parts = value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : undefined;
  }
  return undefined;
};

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
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  empresas?: string[];

  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  remesas?: string[];

  @IsOptional()
  @IsISO8601()
  desde?: string;

  @IsOptional()
  @IsISO8601()
  hasta?: string;
}
