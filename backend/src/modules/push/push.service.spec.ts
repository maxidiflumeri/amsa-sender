import * as webpush from 'web-push';
import { PushService } from './push.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

const send = webpush.sendNotification as jest.Mock;

function crear(env: boolean = true) {
  if (env) {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:a@b.com';
  } else {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  }
  const prisma = {
    pushSuscripcion: { findMany: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 1 }), upsert: jest.fn() },
    usuario: { findFirst: jest.fn(), findMany: jest.fn() },
  };
  const service = new PushService(prisma as never);
  service.onModuleInit();
  return { service, prisma };
}

const payload = { titulo: 'Juan', cuerpo: 'Hola', url: '/wapi/inbox?c=1', tag: 'conv-1' };

describe('PushService', () => {
  beforeEach(() => send.mockReset());

  it('modo deshabilitado: no consulta ni envía, y no hay clave pública', async () => {
    const { service, prisma } = crear(false);
    expect(service.estaHabilitado()).toBe(false);
    expect(service.obtenerClavePublica()).toBeNull();
    await service.enviarAUsuarios([1], payload);
    expect(prisma.pushSuscripcion.findMany).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('envía a todas las suscripciones de los usuarios', async () => {
    const { service, prisma } = crear();
    prisma.pushSuscripcion.findMany.mockResolvedValue([
      { id: 1, endpoint: 'https://p/1', p256dh: 'a', auth: 'b' },
      { id: 2, endpoint: 'https://p/2', p256dh: 'c', auth: 'd' },
    ]);
    send.mockResolvedValue({});
    await service.enviarAUsuarios([5], payload);
    expect(send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(send.mock.calls[0][1])).toEqual(payload);
    expect(prisma.pushSuscripcion.deleteMany).not.toHaveBeenCalled();
  });

  it('borra la suscripción si el push service responde 410 (y 404)', async () => {
    const { service, prisma } = crear();
    prisma.pushSuscripcion.findMany.mockResolvedValue([
      { id: 1, endpoint: 'https://p/1', p256dh: 'a', auth: 'b' },
      { id: 2, endpoint: 'https://p/2', p256dh: 'c', auth: 'd' },
    ]);
    send.mockRejectedValueOnce({ statusCode: 410 }).mockRejectedValueOnce({ statusCode: 404 });
    await expect(service.enviarAUsuarios([5], payload)).resolves.toBeUndefined();
    expect(prisma.pushSuscripcion.deleteMany).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(prisma.pushSuscripcion.deleteMany).toHaveBeenCalledWith({ where: { id: 2 } });
  });

  it('un error 500 no borra ni tira', async () => {
    const { service, prisma } = crear();
    prisma.pushSuscripcion.findMany.mockResolvedValue([{ id: 1, endpoint: 'https://p/1', p256dh: 'a', auth: 'b' }]);
    send.mockRejectedValue({ statusCode: 500 });
    await expect(service.enviarAUsuarios([5], payload)).resolves.toBeUndefined();
    expect(prisma.pushSuscripcion.deleteMany).not.toHaveBeenCalled();
  });

  it('si falla la base, no tira', async () => {
    const { service, prisma } = crear();
    prisma.pushSuscripcion.findMany.mockRejectedValue(new Error('db'));
    await expect(service.enviarAUsuarios([5], payload)).resolves.toBeUndefined();
  });

  describe('notificarMensajeWapiEntrante', () => {
    const msg = { tipo: 'text', contenido: { text: 'Hola, quiero pagar' } };

    it('conversación asignada: solo al asesor asignado', async () => {
      const { service, prisma } = crear();
      prisma.usuario.findFirst.mockResolvedValue({ id: 7 });
      prisma.pushSuscripcion.findMany.mockResolvedValue([{ id: 1, endpoint: 'https://p/1', p256dh: 'a', auth: 'b' }]);
      send.mockResolvedValue({});
      await service.notificarMensajeWapiEntrante(
        { id: 9, numero: '549111', nombre: 'Juan', estado: 'asignada', asignadoAId: 7 },
        msg,
      );
      expect(prisma.pushSuscripcion.findMany).toHaveBeenCalledWith({ where: { usuarioId: { in: [7] } } });
      expect(prisma.usuario.findMany).not.toHaveBeenCalled();
      expect(JSON.parse(send.mock.calls[0][1])).toEqual({
        titulo: 'Juan',
        cuerpo: 'Hola, quiero pagar',
        url: '/wapi/inbox?c=9',
        tag: 'conv-9',
      });
    });

    it('sin asignar: a los usuarios activos con wapi.inbox', async () => {
      const { service, prisma } = crear();
      prisma.usuario.findMany.mockResolvedValue([
        { id: 1, rolObj: { permisos: ['wapi.inbox', 'x'] } },
        { id: 2, rolObj: { permisos: ['email.reportes'] } },
        { id: 3, rolObj: { permisos: ['wapi.inbox.admin', 'wapi.inbox'] } },
      ]);
      prisma.pushSuscripcion.findMany.mockResolvedValue([]);
      await service.notificarMensajeWapiEntrante(
        { id: 9, numero: '549111', nombre: null, estado: 'sin_asignar', asignadoAId: null },
        msg,
      );
      expect(prisma.pushSuscripcion.findMany).toHaveBeenCalledWith({ where: { usuarioId: { in: [1, 3] } } });
    });

    it('reabierta (sin_asignar con asignadoAId viejo) va a todos, no al viejo asesor', async () => {
      const { service, prisma } = crear();
      prisma.usuario.findMany.mockResolvedValue([{ id: 1, rolObj: { permisos: ['wapi.inbox'] } }]);
      prisma.pushSuscripcion.findMany.mockResolvedValue([]);
      await service.notificarMensajeWapiEntrante(
        { id: 9, numero: '549111', estado: 'sin_asignar', asignadoAId: 7 },
        msg,
      );
      expect(prisma.usuario.findFirst).not.toHaveBeenCalled();
      expect(prisma.pushSuscripcion.findMany).toHaveBeenCalledWith({ where: { usuarioId: { in: [1] } } });
    });

    it('asesor asignado inactivo: avisa como si estuviera sin asignar', async () => {
      const { service, prisma } = crear();
      prisma.usuario.findFirst.mockResolvedValue(null);
      await service.notificarMensajeWapiEntrante(
        { id: 9, numero: '549111', estado: 'asignada', asignadoAId: 7 },
        msg,
      );
      // Busca a los usuarios con `wapi.inbox` en lugar de quedarse sin destinatarios.
      expect(prisma.usuario.findMany).toHaveBeenCalled();
    });

    it('ignora reacciones y nunca tira', async () => {
      const { service, prisma } = crear();
      await service.notificarMensajeWapiEntrante(
        { id: 9, numero: '1', estado: 'sin_asignar' },
        { tipo: 'reaction', contenido: {} },
      );
      expect(prisma.usuario.findMany).not.toHaveBeenCalled();
      prisma.usuario.findMany.mockRejectedValue(new Error('db'));
      await expect(
        service.notificarMensajeWapiEntrante({ id: 9, numero: '1', estado: 'sin_asignar' }, { tipo: 'text', contenido: {} }),
      ).resolves.toBeUndefined();
    });
  });

  describe('resumirMensaje', () => {
    it('recorta a 120 y resume adjuntos', () => {
      expect(PushService.resumirMensaje('text', { text: 'a'.repeat(300) })).toHaveLength(120);
      expect(PushService.resumirMensaje('image', {})).toBe('Imagen');
      expect(PushService.resumirMensaje('image', { caption: 'comprobante' })).toBe('comprobante');
      expect(PushService.resumirMensaje('document', {})).toBe('Archivo adjunto');
      expect(PushService.resumirMensaje('audio', {})).toBe('Audio');
    });
  });

  it('suscribir hace upsert por endpoint', async () => {
    const { service, prisma } = crear();
    await service.suscribir(3, 'https://p/x', { p256dh: 'a', auth: 'b' }, 'UA');
    expect(prisma.pushSuscripcion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { endpoint: 'https://p/x' } }),
    );
  });
});
