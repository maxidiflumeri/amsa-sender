import { IsInt, IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class MensajeEntranteDto {
  @IsInt()
  configId: number;

  @IsString()
  numero: string;

  @IsOptional()
  @IsString()
  nombre: string | null;

  @IsString()
  waMessageId: string;

  @IsString()
  tipo: string;

  @IsObject()
  contenido: Record<string, any>;

  @Type(() => Date)
  timestamp: Date;

  @IsOptional()
  @IsBoolean()
  enviarBienvenidaForzada?: boolean;
}
