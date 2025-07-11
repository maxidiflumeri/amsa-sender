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
                html: this.insertHeaderAndFooter(html),
            });

            return { success: true };
        } catch (error) {
            this.logger.error(`📄 Error al enviar el mail: ${error.message}`);
            throw new InternalServerErrorException(`Error al enviar el correo: ${error.message}`);
        }
    }

    private insertHeaderAndFooter(html: string) {
        const verEnNavegadorUrl = `https://amsasender.anamayasa.com.ar/mailing/vista/${Date.now()}`; // cambiar por campaña/contacto real        
        const urlDesuscribirse = `https://amsasender.anamayasa.com.ar/mailing/desuscribirse/mock`;

        // 🔧 Insertar encabezado y footer al HTML original
        const htmlFinal = `
          <div style="text-align: center; font-size: 12px; color: #888; margin-top: 10px;">
            <a href="${verEnNavegadorUrl}" target="_blank" style="color: #888;">Ver en mi navegador</a>
          </div>
          ${html}
          <hr style="margin-top: 40px; border: none; border-top: 1px solid #ccc;" />
          <div style="font-size: 11px; color: #666; text-align: center; padding: 20px;">
            <div>              
              <a href="${urlDesuscribirse}" style="margin-left: 10px; color: #666;">Desuscribite</a>
            </div>
            <p style="margin: 10px 0;">
              Recibes este mail porque estás suscripto a nuestra lista de correos.<br />
              Ana Maya S.A. - Dirección - Ciudad - Provincia - Argentina<br />
              <a href="https://www.anamayasa.com.ar" style="color: #666;">www.anamayasa.com.ar</a>
            </p>
            <p style="font-size: 10px; color: #999;">
              Mensaje enviado automáticamente desde AMSA Sender
            </p>
          </div>
        `;

        return htmlFinal;
    }
}

