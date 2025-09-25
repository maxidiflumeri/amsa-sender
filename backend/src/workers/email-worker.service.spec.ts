// test/email-worker.service.spec.ts
import { EmailWorkerService } from "./email-worker.service";

// ---- Mocks de módulos auxiliares ----
jest.mock('nodemailer', () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'mocked@id' });
    return {
        __esModule: true,
        createTransport: jest.fn(() => ({ sendMail })),
        // exponemos para assertions
        _sendMail: sendMail,
    };
});

jest.mock('../src/common/rate-limit', () => ({
    acquireGlobalSesSlot: jest.fn().mockResolvedValue(undefined),
    // simplificamos lotes -> un solo lote
    chunkArray: (arr: any[]) => [arr],
    sleep: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/common/renderTemplate', () => ({
    renderTemplate: (tpl: string) => tpl,
    insertHeaderAndFooter: (html: string) => html,
}));

jest.mock('../src/common/inyectEmailTracking', () => ({
    prepararHtmlConTracking_safe: (html: string) => html,
}));

jest.mock('../src/common/generateTrackingTok', () => ({
    generarTrackingTok: () => 'tok',
}));

jest.mock('../src/common/bounce.common', () => ({
    buildAmsaHeader: () => 'xhdr',
    injectHtmlMarker: (html: string) => html,
}));

jest.mock('../src/common/email-normalize.common', () => ({
    normalizeEmail: (e: string) => e.trim().toLowerCase(),
    hashEmail: (e: string) => `hash:${e.trim().toLowerCase()}`,
}));

// ---- Util local para obtener el sendMail mock ----
const getSendMailMock = () => {
    // @ts-ignore
    const nodemailer = require('nodemailer');
    return nodemailer._sendMail as jest.Mock;
};

describe('EmailWorkerService', () => {
    const prisma = {
        campañaEmail: { findUnique: jest.fn(), update: jest.fn() },
        templateEmail: { findUnique: jest.fn() },
        cuentaSMTP: { findUnique: jest.fn() },
        emailDesuscripciones: { findMany: jest.fn() },
        reporteEmail: { create: jest.fn(), update: jest.fn() },
        $queryRaw: jest.fn(),
    } as any;

    const descService = {
        signUnsubToken: jest.fn().mockReturnValue('unsub-token'),
    } as any;

    const pubClient = {
        publish: jest.fn().mockResolvedValue(1),
    } as any;

    const subClient = {
        publish: jest.fn().mockResolvedValue(1),
    } as any;

    beforeEach(() => {
        jest.clearAllMocks();

        process.env.AWS_SMTP_USER = 'smtp@anamayasa.com.ar';
        process.env.AWS_SMTP_PASSWORD = 'pass';
        process.env.AWS_SMTP_HOST = 'email-smtp.us-east-1.amazonaws.com';
        process.env.AWS_SMTP_PORT = '587';
        process.env.SES_CONFIG_SET = 'amsa-sender-prod';
        process.env.PUBLIC_API_BASE_URL = 'https://api.example.com/api';
        process.env.FRONT_BASE_URL = 'https://front.example.com';
        process.env.EMAIL_MAX_PARALLEL_CAMPAIGNS = '5'
    });

    it('filtra desuscripto y suprimido, envía solo a permitido y marca estados correctos', async () => {
        const worker = new EmailWorkerService(
            prisma,
            descService,
            pubClient,
            subClient,
        );

        // Datos de campaña / template / smtp
        prisma.campañaEmail.findUnique.mockResolvedValue({
            id: 1,
            contactos: [
                { id: 10, email: 'unsub@example.com', datos: {} },
                { id: 11, email: 'supp@example.com', datos: {} },
                { id: 12, email: 'ok@example.com', datos: {} },
            ],
        });

        prisma.templateEmail.findUnique.mockResolvedValue({
            id: 2,
            html: '<h1>Hola {{name}}</h1>',
            asunto: 'Asunto {{name}}',
        });

        prisma.cuentaSMTP.findUnique.mockResolvedValue({
            id: 3,
            remitente: 'Remitente',
            usuario: 'smtp@anamayasa.com.ar',
        });

        // Desuscripciones (por hash)
        prisma.emailDesuscripciones.findMany.mockResolvedValue([
            { emailHash: 'hash:unsub@example.com' },
        ]);

        // Vista de supresión -> retorna 'supp@example.com' como suprimido
        prisma.$queryRaw.mockResolvedValue([
            { email: 'supp@example.com', bounceType: 'Permanent', bounceSubType: 'General' },
        ]);

        // reporteEmail.create -> devolver un id para el permitido (pendiente)
        let createAutoId = 1000;
        prisma.reporteEmail.create.mockImplementation(async ({ data }: any) => {
            // devolvemos trackingTok null para que update lo setee en el flujo
            return { id: createAutoId++, trackingTok: null, ...data };
        });

        const sendMail = getSendMailMock();

        // Ejecutar el job
        // @ts-ignore (simulamos un Job minimal)
        await worker['procesarJob']({ data: { idCampania: 1, idTemplate: 2, idCuentaSmtp: 3 } });

        // 1) Solo se envía al permitido
        expect(sendMail).toHaveBeenCalledTimes(1);
        expect(sendMail.mock.calls[0][0].to).toBe('ok@example.com');

        // 2) Se crean 3 reportes: desuscripto, omitido(suppressed), pendiente(permitido)
        expect(prisma.reporteEmail.create).toHaveBeenCalledTimes(3);

        // a) Desuscripto
        expect(prisma.reporteEmail.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    contactoId: 10,
                    estado: 'Desuscripto',
                }),
            }),
        );

        // b) Suprimido -> estado "omitido" (o el que configures)
        expect(prisma.reporteEmail.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    contactoId: 11,
                    estado: 'omitido',
                    error: expect.stringContaining('Suppressed (hard bounce/complaint)'),
                }),
            }),
        );

        // c) Permitido -> primero "pendiente"
        expect(prisma.reporteEmail.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    contactoId: 12,
                    estado: 'pendiente',
                }),
            }),
        );

        // 3) Luego actualiza a "enviado" el permitido
        expect(prisma.reporteEmail.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ id: expect.any(Number) }),
                data: expect.objectContaining({ estado: 'enviado' }),
            }),
        );

        // 4) Publica progreso y finaliza campaña
        expect(pubClient.publish).toHaveBeenCalledWith(
            'progreso-envio-mail',
            expect.any(String),
        );
        expect(pubClient.publish).toHaveBeenCalledWith(
            'campania-finalizada',
            JSON.stringify({ campañaId: 1 }),
        );

        expect(prisma.campañaEmail.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 1 },
                data: expect.objectContaining({ estado: 'finalizada' }),
            }),
        );
    });
});