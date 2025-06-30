import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { CreateCuentaDto } from './dtos/create-cuenta.dto';

@Injectable()
export class SmtpService {
    constructor(private prisma: PrismaService) { }

    async crearCuenta(data: CreateCuentaDto) {
        const isValid = await this.validarSMTP(data);
        if (!isValid) throw new BadRequestException('No se pudo validar la cuenta SMTP');

        return this.prisma.cuentaSMTP.create({ data });
    }

    async listarCuentas() {
        return this.prisma.cuentaSMTP.findMany({ orderBy: { creadoAt: 'desc' } });
    }

    async probarConexion(id: number): Promise<{ ok: boolean }> {
        const cuenta = await this.prisma.cuentaSMTP.findUnique({ where: { id } });
        if (!cuenta) throw new NotFoundException('Cuenta no encontrada');

        try {
            const cuentaDto = {
                emailFrom: cuenta.emailFrom,
                host: cuenta.host,
                puerto: cuenta.puerto,
                usuario: cuenta.usuario,
                password: cuenta.password,
            } as CreateCuentaDto;
            const validate = await this.validarSMTP(cuentaDto);
            
            return { ok: validate };
        } catch (err) {
            throw new BadRequestException('Error de conexión SMTP: ' + err.message);
        }
    }

    private async validarSMTP(data: CreateCuentaDto): Promise<boolean> {
        try {
            const transporter = nodemailer.createTransport({
                host: data.host,
                port: data.puerto,
                secure: data.puerto === 465, // true para SSL
                auth: {
                    user: data.usuario,
                    pass: data.password,
                },
            });

            await transporter.verify(); // lanza error si falla
            return true;
        } catch (err) {
            console.error('SMTP Validation error:', err.message);
            return false;
        }
    }
}