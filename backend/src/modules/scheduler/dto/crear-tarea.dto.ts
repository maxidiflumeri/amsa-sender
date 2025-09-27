// src/scheduler/dto/crear-tarea.dto.ts
import { IsBoolean, IsEnum, IsString, IsArray, IsObject } from 'class-validator';

export class CrearTareaDto {
    @IsString() nombre: string;
    @IsEnum(['REPORTE_EMAIL_DIARIO'] as any) tipo: 'REPORTE_EMAIL_DIARIO';
    @IsString() expresionCron: string;
    @IsString() zonaHoraria: string;
    @IsBoolean() habilitada: boolean;
    @IsArray() destinatarios: string[];
    @IsObject() configuracion: any;
}