import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EnvioEmailService {
    private readonly logger = new Logger(EnvioEmailService.name);

    constructor(private prisma: PrismaService) { }

    async enviarCorreo({
        html,
        to,
        subject,
        smtpId,
    }: {
        html: string;
        to: string;
        subject: string;
        smtpId: number;
    }) {

        const smtp = await this.prisma.cuentaSMTP.findUnique({ where: { id: smtpId } });
        if (!smtp) throw new NotFoundException('Cuenta SMTP no encontrada');

        const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: smtp.puerto,
            secure: false, // true for 465, false for other ports
            auth: {
                user: smtp.usuario,
                pass: smtp.password,
            },
        });

        try {
            await transporter.sendMail({
                from: `"${smtp.nombre}" <${smtp.usuario}>`,                
                to,
                subject,
                html,
            });

            return { success: true };
        } catch (error) {
            this.logger.error(`📄 Error al enviar el mail: ${error.message}`);
            throw new InternalServerErrorException(`Error al enviar el correo: ${error.message}`);
        }
    }
}