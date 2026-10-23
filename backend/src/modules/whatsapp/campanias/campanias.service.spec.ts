import { BadRequestException } from '@nestjs/common';
import { CampaniasService } from './campanias.service';

// Pausa y reanudación de campañas de WhatsApp Web. La campaña #513 quedó meses en 'pausa_pendiente' sin job: una
// segunda pausa la había movido ahí, reanudar no la aceptaba y la pantalla no ofrecía ninguna acción.

function armar({ campaña = null as any, sesiones = [] as any[], jobs = {} as Record<string, any[]> } = {}) {
    const prisma = {
        campaña: {
            findUnique: jest.fn().mockResolvedValue(campaña),
            update: jest.fn().mockResolvedValue({}),
        },
        sesion: { findMany: jest.fn().mockResolvedValue(sesiones) },
    };
    const cola = {
        add: jest.fn().mockResolvedValue({ id: 'nuevo' }),
        getJobs: jest.fn(async ([tipo]: string[]) => jobs[tipo] ?? []),
    };
    const service = new CampaniasService(prisma as any, cola as any, {} as any);
    return { service, prisma, cola };
}

const CONFIG = { batchSize: 10, delayEntreMensajes: 1000, delayEntreLotes: 5000 };

describe('CampaniasService.pausarCampaña', () => {
    it('una campaña enviando pasa a pausada', async () => {
        const { service, prisma } = armar({ campaña: { estado: 'procesando' } });
        await service.pausarCampaña(1);
        expect(prisma.campaña.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { estado: 'pausada' } });
    });

    it('una agendada queda con la pausa pendiente para su job', async () => {
        const { service, prisma } = armar({ campaña: { estado: 'programada' } });
        await service.pausarCampaña(1);
        expect(prisma.campaña.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { estado: 'pausa_pendiente' } });
    });

    it.each(['pausada', 'pausa_pendiente'])('pausar una %s no la toca', async (estado) => {
        const { service, prisma } = armar({ campaña: { estado } });
        await service.pausarCampaña(1);
        expect(prisma.campaña.update).not.toHaveBeenCalled();
    });

    it.each(['pendiente', 'finalizada', 'error'])('estado %s: no se puede pausar', async (estado) => {
        const { service, prisma } = armar({ campaña: { estado } });
        await expect(service.pausarCampaña(1)).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.campaña.update).not.toHaveBeenCalled();
    });
});

describe('CampaniasService.reanudarCampaña', () => {
    const pausada = (extra = {}) => ({ id: 513, estado: 'pausa_pendiente', sesiones: '["s-vieja"]', config: CONFIG, ...extra });

    it('una pausa_pendiente sin job se reanuda encolando un envío nuevo', async () => {
        const { service, prisma, cola } = armar({ campaña: pausada({ sesiones: '["s-1"]' }), sesiones: [{ sessionId: 's-1' }] });
        await service.reanudarCampaña(513);
        expect(cola.add).toHaveBeenCalledWith('enviar', { sessionIds: ['s-1'], campaña: 513, config: CONFIG });
        expect(prisma.campaña.update).toHaveBeenCalledWith({
            where: { id: 513 },
            data: { estado: 'procesando', pausada: false, sesiones: '["s-1"]' },
        });
    });

    it('marca la campaña como enviando antes de encolar (si no, el worker la ve pausada y corta)', async () => {
        const { service, prisma, cola } = armar({ campaña: pausada({ sesiones: '["s-1"]' }), sesiones: [{ sessionId: 's-1' }] });
        await service.reanudarCampaña(513);
        expect(prisma.campaña.update.mock.invocationCallOrder[0]).toBeLessThan(cola.add.mock.invocationCallOrder[0]);
    });

    it('si no se puede encolar, la devuelve a la pausa con sus sesiones', async () => {
        const { service, prisma, cola } = armar({ campaña: pausada({ sesiones: '["s-1"]', pausada: true }), sesiones: [{ sessionId: 's-1' }] });
        cola.add.mockRejectedValueOnce(new Error('Redis caído'));
        await expect(service.reanudarCampaña(513)).rejects.toThrow('Redis caído');
        expect(prisma.campaña.update).toHaveBeenLastCalledWith({
            where: { id: 513 },
            data: { estado: 'pausada', pausada: true, sesiones: '["s-1"]' },
        });
    });

    it('sin ninguna sesión conectada pide elegir con cuál seguir y no encola', async () => {
        const { service, cola } = armar({ campaña: pausada(), sesiones: [] });
        const error = await service.reanudarCampaña(513).catch((e) => e);
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.getResponse()).toMatchObject({ codigo: 'SIN_SESIONES_CONECTADAS' });
        expect(cola.add).not.toHaveBeenCalled();
    });

    it('con sesiones elegidas sigue con esas y las guarda en la campaña', async () => {
        const { service, prisma, cola } = armar({ campaña: pausada(), sesiones: [{ sessionId: 's-nueva' }] });
        await service.reanudarCampaña(513, ['s-nueva']);
        expect(prisma.sesion.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { sessionId: { in: ['s-nueva'] }, estado: 'conectado' },
        }));
        expect(cola.add).toHaveBeenCalledWith('enviar', { sessionIds: ['s-nueva'], campaña: 513, config: CONFIG });
        expect(prisma.campaña.update.mock.calls[0][0].data.sesiones).toBe('["s-nueva"]');
    });

    it('descarta las sesiones caídas si queda alguna conectada', async () => {
        const { service, cola } = armar({ campaña: pausada({ sesiones: '["s-1","s-2"]' }), sesiones: [{ sessionId: 's-2' }] });
        await service.reanudarCampaña(513);
        expect(cola.add.mock.calls[0][1].sessionIds).toEqual(['s-2']);
    });

    it('si su job agendado sigue en la cola, vuelve a agendada sin encolar otro', async () => {
        const { service, prisma, cola } = armar({ campaña: pausada(), jobs: { delayed: [{ data: { campaña: 513 } }] } });
        await service.reanudarCampaña(513);
        expect(cola.add).not.toHaveBeenCalled();
        expect(prisma.campaña.update).toHaveBeenCalledWith({ where: { id: 513 }, data: { estado: 'programada', pausada: false } });
    });

    it('si su job espera turno en la cola, vuelve a enviando sin encolar otro', async () => {
        const { service, prisma, cola } = armar({
            campaña: pausada({ estado: 'pausada' }),
            jobs: { waiting: [{ data: { campaña: 7 } }, { data: { campaña: 513 } }] },
        });
        await service.reanudarCampaña(513);
        expect(cola.add).not.toHaveBeenCalled();
        expect(prisma.campaña.update).toHaveBeenCalledWith({ where: { id: 513 }, data: { estado: 'procesando', pausada: false } });
    });

    it('un job de otra campaña no cuenta', async () => {
        const { service, cola } = armar({
            campaña: pausada({ sesiones: '["s-1"]' }),
            sesiones: [{ sessionId: 's-1' }],
            jobs: { delayed: [{ data: { campaña: 7 } }] },
        });
        await service.reanudarCampaña(513);
        expect(cola.add).toHaveBeenCalled();
    });

    it.each(['procesando', 'finalizada', 'pendiente'])('estado %s: no se reanuda', async (estado) => {
        const { service, cola } = armar({ campaña: pausada({ estado }) });
        await expect(service.reanudarCampaña(513)).rejects.toBeInstanceOf(BadRequestException);
        expect(cola.add).not.toHaveBeenCalled();
    });

    it('rechaza sessionIds que no son una lista de sesiones', async () => {
        const { service } = armar({ campaña: pausada() });
        await expect(service.reanudarCampaña(513, 's-1')).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.reanudarCampaña(513, [''])).rejects.toBeInstanceOf(BadRequestException);
    });
});
