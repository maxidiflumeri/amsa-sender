import { IsOptional, IsString } from 'class-validator';

export class GuardarWapiConfigDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  phoneNumberId?: string;

  @IsOptional()
  @IsString()
  wabaId?: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  verifyToken?: string;

  @IsOptional()
  @IsString()
  appSecret?: string;

  @IsOptional()
  @IsString()
  msgBienvenida?: string;

  @IsOptional()
  @IsString()
  msgConfirmacionBaja?: string;
}
