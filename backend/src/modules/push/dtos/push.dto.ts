import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  auth: string;
}

export class SuscribirPushDto {
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: false })
  @MaxLength(700)
  endpoint: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

export class DesuscribirPushDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(700)
  endpoint: string;
}

export interface PushPayload {
  titulo: string;
  cuerpo: string;
  url: string;
  tag?: string;
  badgeCount?: number;
}
