import { WapiCampaniasService } from './wapi-campanias.service';

// Reanudar una campaña de WhatsApp API. El 23/10 la #707 quedó "procesando" sin job: el job se encolaba antes de sacarla
// de la pausa, el worker (libre) lo tomó en el mismo milisegundo, la vio pausada y terminó sin enviar.

function armar(campaña: any) {
    const prisma = {
        waApiCampaña: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(campaña),
            update: jest.fn().mockResolvedValue({}),
        },
    };
    const cola = { add: jest.fn().mockResolvedValue({ id: '900' }) };
    const service = new WapiCampaniasService(prisma as any, cola as any, {} as any);
    return { service, prisma, cola };
}

describe('WapiCampaniasService.reanudarCampania', () => {
    it('la saca de la pausa antes de encolar el job y después guarda el job', async () => {
        const { service, prisma, cola } = armar({ id: 707, estado: 'pausada' });
        await service.reanudarCampania(707);
        expect(prisma.waApiCampaña.update).toHaveBeenNthCalledWith(1, { where: { id: 707 }, data: { pausada: false, estado: 'procesando' } });
        expect(prisma.waApiCampaña.update.mock.invocationCallOrder[0]).toBeLessThan(cola.add.mock.invocationCallOrder[0]);
        expect(cola.add).toHaveBeenCalledWith('enviar-campania', { campañaId: 707 }, { removeOnComplete: true, removeOnFail: false });
        expect(prisma.waApiCampaña.update).toHaveBeenLastCalledWith({ where: { id: 707 }, data: { jobId: '900' } });
    });

    it('si no se puede encolar, la deja otra vez en pausa', async () => {
        const { service, prisma, cola } = armar({ id: 707, estado: 'pausada' });
        cola.add.mockRejectedValueOnce(new Error('Redis caído'));
        await expect(service.reanudarCampania(707)).rejects.toThrow('Redis caído');
        expect(prisma.waApiCampaña.update).toHaveBeenLastCalledWith({ where: { id: 707 }, data: { pausada: true, estado: 'pausada' } });
    });

    it('una campaña que no está en pausa no se reanuda', async () => {
        const { service, prisma, cola } = armar({ id: 707, estado: 'procesando' });
        await expect(service.reanudarCampania(707)).rejects.toThrow();
        expect(cola.add).not.toHaveBeenCalled();
        expect(prisma.waApiCampaña.update).not.toHaveBeenCalled();
    });
});
