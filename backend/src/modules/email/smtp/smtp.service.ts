import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { CreateCuentaDto } from './dtos/create-cuenta.dto';
import * as dns from 'dns/promises';
const isValidDomain = require('is-valid-domain');

@Injectable()
export class SmtpService {
    constructor(private prisma: PrismaService) { }

    async crearCuenta(data: CreateCuentaDto) {
        const isValid = await this.validarSMTP(data);
        if (!isValid) throw new BadRequestException('No se pudo validar la cuenta SMTP');
        data.creadoAt = new Date();
        return this.prisma.cuentaSMTP.create({ data });
    }

    async listarCuentas() {
        return this.prisma.cuentaSMTP.findMany({ orderBy: { creadoAt: 'desc' } });
    }

    async probarConexion(id: number): Promise<{ ok: boolean }> {
        const cuenta = await this.prisma.cuentaSMTP.findUnique({ where: { id } });
        if (!cuenta) throw new NotFoundException('Cuenta no encontrada');

        const cuentaDto = {
            emailFrom: cuenta.emailFrom,
            host: cuenta.host,
            puerto: cuenta.puerto,
            usuario: cuenta.usuario,
            password: cuenta.password,
        } as CreateCuentaDto;
        const validate = await this.validarSMTP(cuentaDto);

        if (validate) {
            return { ok: validate };
        }
        throw new BadRequestException('No se pudo conectar con el servidor SMTP. Verificá los datos.');
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

    async verificarDominio(id: number) {
        const cuenta = await this.prisma.cuentaSMTP.findUnique({ where: { id } });
        if (!cuenta) throw new NotFoundException('Cuenta no encontrada');

        const dominio = cuenta.usuario.split('@')[1];
        if (!isValidDomain(dominio)) {
            return { error: 'Dominio inválido' };
        }

        const resultado: any = { dominio };

        // ✅ SPF
        try {
            const spfRecords = await dns.resolveTxt(dominio);
            const spf = spfRecords.flat().find((txt) => txt.startsWith('v=spf1'));
            resultado.spf = spf
                ? { valido: true, valor: spf }
                : {
                    valido: false,
                    sugerencia: `Agregá un registro TXT en ${dominio} con: v=spf1 include:_spf.google.com ~all`,
                };
        } catch {
            resultado.spf = {
                valido: false,
                sugerencia: `No se pudo resolver el registro SPF. Verificá que el dominio tenga uno en formato: v=spf1 include:_spf.google.com ~all`,
            };
        }

        // ✅ DKIM (selector google)
        try {
            const dkimSelector = 'google';
            const dkimRecords = await dns.resolveTxt(`${dkimSelector}._domainkey.${dominio}`);
            const dkim = dkimRecords.flat().find((txt) => txt.includes('v=DKIM1'));
            resultado.dkim = dkim
                ? { valido: true, valor: dkim }
                : {
                    valido: false,
                    sugerencia: `Asegurate de tener habilitada la firma DKIM en Google Workspace y agregá un registro TXT en google._domainkey.${dominio}`,
                };
        } catch {
            resultado.dkim = {
                valido: false,
                sugerencia: `No se pudo resolver el DKIM con selector 'google'. Verificá que esté habilitado en Google Workspace.`,
            };
        }

        // ✅ DMARC
        try {
            const dmarcRecords = await dns.resolveTxt(`_dmarc.${dominio}`);
            const dmarc = dmarcRecords.flat().find((txt) => txt.startsWith('v=DMARC1'));
            resultado.dmarc = dmarc
                ? { valido: true, valor: dmarc }
                : {
                    valido: false,
                    sugerencia: `Agregá un registro TXT en _dmarc.${dominio} con algo como: v=DMARC1; p=none; rua=mailto:tu-email@${dominio}`,
                };
        } catch {
            resultado.dmarc = {
                valido: false,
                sugerencia: `No se pudo encontrar el registro DMARC. Creá uno en _dmarc.${dominio} con: v=DMARC1; p=none; rua=mailto:tu-email@${dominio}`,
            };
        }

        return resultado;
    }

    async eliminarCuenta(id: number) {
        const cuenta = await this.prisma.cuentaSMTP.findUnique({ where: { id } });
        if (!cuenta) throw new NotFoundException('Cuenta no encontrada');

        await this.prisma.cuentaSMTP.delete({ where: { id } });
        return { ok: true }
    }
}