import { IsNotEmpty, IsString, IsIn, IsOptional, IsISO8601 } from 'class-validator';

export class ExportarDetalleDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['csv', 'xlsx'])
  formato: 'csv' | 'xlsx';

  @IsOptional()
  @IsString()
  empresa?: string;

  @IsOptional()
  @IsString()
  remesa?: string;

  @IsOptional()
  @IsISO8601()
  desde?: string;

  @IsOptional()
  @IsISO8601()
  hasta?: string;

  @IsOptional()
  @IsString()
  @IsIn(['whatsapp', 'email', 'wapi'])
  canal?: 'whatsapp' | 'email' | 'wapi';
}
