import { IsOptional, IsString } from 'class-validator';

export class GuardarWapiConfigDto {
  @IsString()
  phoneNumberId: string;

  @IsString()
  wabaId: string;

  @IsString()
  token: string;

  @IsString()
  verifyToken: string;

  @IsOptional()
  @IsString()
  appSecret?: string;
}
