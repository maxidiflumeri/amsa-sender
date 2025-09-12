import { IsEmail, IsNotEmpty, IsInt, IsString } from 'class-validator';

export class CreateCuentaDto {
    @IsNotEmpty()
    @IsString()
    nombre: string;

    @IsNotEmpty()
    @IsString()
    host: string;

    @IsInt()
    puerto: number;

    @IsNotEmpty()
    @IsString()
    usuario: string;

    @IsNotEmpty()
    @IsString()
    password: string;

    @IsNotEmpty()
    @IsString()
    remitente: string;

    @IsEmail()
    emailFrom: string;

    creadoAt?: Date;
}