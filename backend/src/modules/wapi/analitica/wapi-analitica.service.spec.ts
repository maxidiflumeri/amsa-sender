import { diaAR, resumirCierres, WapiAnaliticaService } from './wapi-analitica.service';

describe('productividad de los agentes (cierres)', () => {
  it('cada cierre cuenta: una conversación cerrada dos veces suma dos', () => {
    const r = resumirCierres([
      { usuarioId: 1, conversacionId: 10 },
      { usuarioId: 1, conversacionId: 10 },
      { usuarioId: 1, conversacionId: 11 },
      { usuarioId: 2, conversacionId: 10 },
    ]);
    expect(r.total).toBe(4);
    expect(r.conversacionesDistintas).toBe(2);
    expect(r.porUsuario.get(1)?.cierres).toBe(3);
    expect(r.porUsuario.get(1)?.conversaciones.size).toBe(2);
    expect(r.porUsuario.get(2)?.cierres).toBe(1);
  });

  it('un cierre sin usuario cuenta en el total pero no se le atribuye a nadie', () => {
    const r = resumirCierres([{ usuarioId: null, conversacionId: 5 }]);
    expect(r.total).toBe(1);
    expect(r.porUsuario.size).toBe(0);
  });

  it('el día es el de Argentina: las 22 h del 23/10 son el 23/10, no el 24', () => {
    expect(diaAR(new Date('2026-10-23T22:30:00-03:00'))).toBe('2026-10-23');
    expect(diaAR(new Date('2026-10-24T00:10:00-03:00'))).toBe('2026-10-24');
  });

  it('metricasAgentes: las resueltas salen de los cierres del período, no del estado actual', async () => {
    const desde = new Date('2026-10-01T00:00:00-03:00');
    const hasta = new Date('2026-10-02T23:59:59.999-03:00');
    const prisma = {
      waApiCierreConversacion: {
        findMany: jest.fn().mockResolvedValue([
          { usuarioId: 7, conversacionId: 1, creadoAt: new Date('2026-10-01T10:00:00-03:00') },
          // La misma conversación, reabierta y cerrada de nuevo al otro día (a las 22 h: sigue siendo el 02/10).
          { usuarioId: 7, conversacionId: 1, creadoAt: new Date('2026-10-02T22:00:00-03:00') },
          // Un agente que ya no está activo: su cierre sigue contando.
          { usuarioId: 9, conversacionId: 2, creadoAt: new Date('2026-10-02T09:00:00-03:00') },
        ]),
      },
      usuario: {
        findMany: jest.fn().mockResolvedValue([
          // La conversación 1 hoy está reabierta (sin_asignar): con el cálculo viejo, 0 resueltas.
          { id: 7, nombre: 'Romi', email: 'r@x', activo: true, conversaciones: [] },
          { id: 9, nombre: 'Ex', email: 'e@x', activo: false, conversaciones: [] },
        ]),
      },
      waApiConversacion: { findMany: jest.fn().mockResolvedValue([]) },
      waApiMensaje: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new WapiAnaliticaService(prisma as never, {} as never);

    const r = await service.metricasAgentes(desde, hasta);

    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ activo: true }, { id: { in: [7, 9] } }] } }),
    );
    expect(r.global.resueltas).toBe(3);
    expect(r.global.conversacionesCerradas).toBe(2);
    const romi = r.agentes.find((a) => a.id === 7)!;
    expect(romi.resueltas).toBe(2);
    expect(romi.conversacionesCerradas).toBe(1);
    expect(r.agentes.find((a) => a.id === 9)!.resueltas).toBe(1);
    expect(r.evolucionDiaria).toEqual([
      { fecha: '2026-10-01', convs: 0, resueltas: 1 },
      { fecha: '2026-10-02', convs: 0, resueltas: 2 },
    ]);
  });
});
