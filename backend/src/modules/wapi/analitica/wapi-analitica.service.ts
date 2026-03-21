import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WapiAnaliticaService {
  constructor(private readonly prisma: PrismaService) {}

  async metricasCampania(id: number) {
    // 1. Obtener campaña con template y config
    const campania = await this.prisma.waApiCampaña.findUnique({
      where: { id },
      include: {
        template: true,
        waConfig: true,
      },
    });
    if (!campania) throw new NotFoundException(`Campaña ${id} no encontrada`);

    // 2. Reportes de la campaña
    const reportes = await this.prisma.waApiReporte.findMany({
      where: { campañaId: id },
    });

    // 3. Total de contactos
    const totalContactos = await this.prisma.waApiContacto.count({
      where: { campañaId: id },
    });

    // 4. Números de contactos
    const contactos = await this.prisma.waApiContacto.findMany({
      where: { campañaId: id },
      select: { numero: true },
    });
    const numerosContactos = contactos.map(c => c.numero);

    // 5. Conversaciones de los contactos de esta campaña
    const conversaciones = await this.prisma.waApiConversacion.findMany({
      where: { numero: { in: numerosContactos } },
      include: {
        mensajes: {
          where: { fromMe: false },
          take: 1,
        },
        asignadoA: { select: { id: true, nombre: true } },
      },
    });

    // 6. Mensajes de botón de contactos de esta campaña
    const convIds = conversaciones.map(c => c.id);
    const mensajesBoton = convIds.length > 0
      ? await this.prisma.waApiMensaje.findMany({
          where: {
            conversacionId: { in: convIds },
            tipo: 'button',
            fromMe: false,
          },
          select: { contenido: true, conversacionId: true },
        })
      : [];

    // 7. Bajas de la campaña
    const bajasCampania = await this.prisma.waApiBaja.findMany({
      where: { campañaId: id },
      select: { numero: true },
    });
    const numerosBajas = new Set(bajasCampania.map(b => b.numero));

    // Calcular conteos
    const enviados = reportes.filter(r => ['sent', 'delivered', 'read'].includes(r.estado)).length;
    const entregados = reportes.filter(r => ['delivered', 'read'].includes(r.estado)).length;
    const leidos = reportes.filter(r => r.estado === 'read').length;
    const fallidos = reportes.filter(r => r.estado === 'failed').length;
    const omitidosPorBaja = reportes.filter(r => r.estado === 'failed' && r.error?.includes('lista de bajas')).length;
    const pendientes = reportes.filter(r => r.estado === 'pendiente').length;

    // Tasas
    const tasaEntrega = totalContactos > 0 ? Math.round((entregados / enviados) * 1000) / 10 : 0;
    const tasaLectura = totalContactos > 0 ? Math.round((leidos / enviados) * 1000) / 10 : 0;
    const tasaFallo = totalContactos > 0 ? Math.round((fallidos / totalContactos) * 1000) / 10 : 0;

    // Tiempos de entrega y lectura
    const tiemposEntrega = reportes
      .filter(r => r.enviadoAt && r.entregadoAt)
      .map(r => new Date(r.entregadoAt!).getTime() - new Date(r.enviadoAt!).getTime());

    const tiemposLectura = reportes
      .filter(r => r.enviadoAt && r.leidoAt)
      .map(r => new Date(r.leidoAt!).getTime() - new Date(r.enviadoAt!).getTime());

    const avgEntregaMs = tiemposEntrega.length > 0
      ? Math.round(tiemposEntrega.reduce((a, b) => a + b, 0) / tiemposEntrega.length)
      : null;

    const avgLecturaMs = tiemposLectura.length > 0
      ? Math.round(tiemposLectura.reduce((a, b) => a + b, 0) / tiemposLectura.length)
      : null;

    // Distribución horaria de lecturas
    const horasCount = new Array(24).fill(0);
    reportes.filter(r => r.leidoAt).forEach(r => {
      const hora = new Date(r.leidoAt!).getHours();
      horasCount[hora]++;
    });
    const distribucionHorariaLecturas = horasCount.map((count, hora) => ({ hora, count }));

    // Engagement
    const respondieron = conversaciones.filter(c => c.mensajes.length > 0).length;

    const presionaronBoton = mensajesBoton.length;

    // Breakdown de payloads de botones
    const payloadMap: Record<string, number> = {};
    mensajesBoton.forEach(m => {
      const contenido = m.contenido as any;
      const payload = contenido?.buttonPayload || contenido?.buttonText || 'desconocido';
      payloadMap[payload] = (payloadMap[payload] || 0) + 1;
    });
    const payloadBreakdown = Object.entries(payloadMap)
      .map(([payload, count]) => ({ payload, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Conversaciones stats
    const sinAsignar = conversaciones.filter(c => c.estado === 'sin_asignar').length;
    const asignadas = conversaciones.filter(c => c.estado === 'asignada').length;
    const resueltas = conversaciones.filter(c => c.estado === 'resuelta').length;

    // Errores top 10
    const errorMap: Record<string, number> = {};
    reportes.filter(r => r.error).forEach(r => {
      const err = r.error!.slice(0, 200);
      errorMap[err] = (errorMap[err] || 0) + 1;
    });
    const errores = Object.entries(errorMap)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      campania: {
        id: campania.id,
        nombre: campania.nombre,
        estado: campania.estado,
        createdAt: campania.createdAt,
        enviadoAt: campania.enviadoAt,
        template: campania.template
          ? { metaNombre: campania.template.metaNombre, categoria: campania.template.categoria }
          : null,
        config: campania.waConfig
          ? { nombre: campania.waConfig.nombre, phoneNumberId: campania.waConfig.phoneNumberId }
          : null,
      },
      conteos: {
        total: totalContactos,
        enviados,
        entregados,
        leidos,
        fallidos,
        omitidosPorBaja,
        pendientes,
      },
      tasas: {
        entrega: isNaN(tasaEntrega) ? 0 : tasaEntrega,
        lectura: isNaN(tasaLectura) ? 0 : tasaLectura,
        fallo: isNaN(tasaFallo) ? 0 : tasaFallo,
      },
      tiempos: {
        avgEntregaMs,
        avgLecturaMs,
        distribucionHorariaLecturas,
      },
      engagement: {
        respondieron,
        presionaronBoton,
        bajas: bajasCampania.length,
        payloadBreakdown,
      },
      conversaciones: {
        total: conversaciones.length,
        sinAsignar,
        asignadas,
        resueltas,
      },
      errores,
    };
  }

  async contactosCampania(id: number, page: number, limit: number, filtro: string) {
    // Obtener contactos de la campaña con sus reportes
    const contactos = await this.prisma.waApiContacto.findMany({
      where: { campañaId: id },
      include: { reporte: true },
    });

    const numeros = contactos.map(c => c.numero);

    // Conversaciones de esos contactos
    const conversaciones = await this.prisma.waApiConversacion.findMany({
      where: { numero: { in: numeros } },
      include: {
        mensajes: { where: { fromMe: false }, take: 1 },
      },
    });
    const convMap = new Map(conversaciones.map(c => [c.numero, c]));

    // Bajas
    const bajas = await this.prisma.waApiBaja.findMany({
      where: { numero: { in: numeros } },
      select: { numero: true },
    });
    const bajasSet = new Set(bajas.map(b => b.numero));

    // Mensajes de botón por conversación
    const convIds = conversaciones.map(c => c.id);
    const mensajesBoton = convIds.length > 0
      ? await this.prisma.waApiMensaje.findMany({
          where: { conversacionId: { in: convIds }, tipo: 'button', fromMe: false },
          select: { conversacionId: true, contenido: true },
        })
      : [];
    const botonConvIds = new Set(mensajesBoton.map(m => m.conversacionId));

    // Armar lista completa
    let lista = contactos.map(c => {
      const conv = convMap.get(c.numero);
      const reporte = c.reporte;
      return {
        numero: c.numero,
        nombre: c.nombre,
        estado: reporte?.estado ?? 'pendiente',
        enviadoAt: reporte?.enviadoAt ?? null,
        entregadoAt: reporte?.entregadoAt ?? null,
        leidoAt: reporte?.leidoAt ?? null,
        fallidoAt: reporte?.fallidoAt ?? null,
        error: reporte?.error ?? null,
        respondio: conv ? conv.mensajes.length > 0 : false,
        presionoBoton: conv ? botonConvIds.has(conv.id) : false,
        dioDebaja: bajasSet.has(c.numero),
        conversacionId: conv?.id ?? null,
      };
    });

    // Aplicar filtro
    if (filtro === 'enviados') {
      lista = lista.filter(c => ['sent', 'delivered', 'read'].includes(c.estado));
    } else if (filtro === 'entregados') {
      lista = lista.filter(c => ['delivered', 'read'].includes(c.estado));
    } else if (filtro === 'leidos') {
      lista = lista.filter(c => c.estado === 'read');
    } else if (filtro === 'fallidos') {
      lista = lista.filter(c => c.estado === 'failed');
    } else if (filtro === 'respondieron') {
      lista = lista.filter(c => c.respondio);
    } else if (filtro === 'bajas') {
      lista = lista.filter(c => c.dioDebaja);
    }

    const total = lista.length;
    const data = lista.slice((page - 1) * limit, page * limit);

    return { data, total, page, limit };
  }

  async conversacionesCampania(id: number) {
    const contactos = await this.prisma.waApiContacto.findMany({
      where: { campañaId: id },
      select: { numero: true },
    });
    const numeros = contactos.map(c => c.numero);

    const conversaciones = await this.prisma.waApiConversacion.findMany({
      where: { numero: { in: numeros } },
      include: {
        asignadoA: { select: { id: true, nombre: true } },
      },
      orderBy: { ultimoMensajeAt: 'desc' },
    });

    return conversaciones.map(c => ({
      id: c.id,
      numero: c.numero,
      nombre: c.nombre,
      estado: c.estado,
      asignadoA: c.asignadoA ? { id: c.asignadoA.id, nombre: c.asignadoA.nombre } : null,
      ultimoMensajeAt: c.ultimoMensajeAt,
      primeraRespuestaAt: c.primeraRespuestaAt,
      resolvedAt: c.resolvedAt,
      ventanaAbierta: c.ventana24hAt
        ? Date.now() - new Date(c.ventana24hAt).getTime() < 24 * 60 * 60 * 1000
        : false,
    }));
  }

  async metricasAgentes(desde: Date, hasta: Date) {
    // Obtener todos los usuarios con sus conversaciones en el rango
    const usuarios = await this.prisma.usuario.findMany({
      where: { activo: true },
      include: {
        conversaciones: {
          where: {
            ultimoMensajeAt: { gte: desde, lte: hasta },
          },
        },
      },
    });

    // Conversaciones globales con actividad en el período
    const todasConvs = await this.prisma.waApiConversacion.findMany({
      where: { ultimoMensajeAt: { gte: desde, lte: hasta } },
      select: { id: true, estado: true, primeraRespuestaAt: true, resolvedAt: true, ultimoMensajeAt: true },
    });

    const totalConvs = todasConvs.length;
    const resueltas = todasConvs.filter(c => c.estado === 'resuelta').length;

    const tiemposPrimResp = todasConvs
      .filter(c => c.primeraRespuestaAt && c.ultimoMensajeAt)
      .map(c => new Date(c.primeraRespuestaAt!).getTime() - new Date(c.ultimoMensajeAt!).getTime());

    const tiemposResolucion = todasConvs
      .filter(c => c.resolvedAt && c.ultimoMensajeAt)
      .map(c => new Date(c.resolvedAt!).getTime() - new Date(c.ultimoMensajeAt!).getTime());

    const avgPrimeraRespuestaMs = tiemposPrimResp.length > 0
      ? Math.round(tiemposPrimResp.reduce((a, b) => a + b, 0) / tiemposPrimResp.length)
      : null;

    const avgResolucionMs = tiemposResolucion.length > 0
      ? Math.round(tiemposResolucion.reduce((a, b) => a + b, 0) / tiemposResolucion.length)
      : null;

    // Métricas por agente
    const agentesData = await Promise.all(
      usuarios.map(async u => {
        const convs = u.conversaciones;
        const convIds = convs.map(c => c.id);

        // Mensajes enviados por el asesor en el período
        const mensajesEnviados = convIds.length > 0
          ? await this.prisma.waApiMensaje.count({
              where: {
                conversacionId: { in: convIds },
                fromMe: true,
                timestamp: { gte: desde, lte: hasta },
              },
            })
          : 0;

        // Actividad por hora
        const mensajesPorHora = convIds.length > 0
          ? await this.prisma.waApiMensaje.findMany({
              where: {
                conversacionId: { in: convIds },
                fromMe: true,
                timestamp: { gte: desde, lte: hasta },
              },
              select: { timestamp: true },
            })
          : [];

        const horasCount = new Array(24).fill(0);
        mensajesPorHora.forEach(m => {
          const hora = new Date(m.timestamp).getHours();
          horasCount[hora]++;
        });
        const actividadPorHora = horasCount.map((count, hora) => ({ hora, count }));

        // Tiempos del agente
        const tPrimResp = convs
          .filter(c => c.primeraRespuestaAt)
          .map(c => new Date(c.primeraRespuestaAt!).getTime() - new Date(c.creadoAt).getTime());

        const tResol = convs
          .filter(c => c.resolvedAt)
          .map(c => new Date(c.resolvedAt!).getTime() - new Date(c.creadoAt).getTime());

        return {
          id: u.id,
          nombre: u.nombre,
          email: u.email,
          asignadas: convs.length,
          resueltas: convs.filter(c => c.estado === 'resuelta').length,
          activas: convs.filter(c => c.estado === 'asignada').length,
          avgPrimeraRespuestaMs: tPrimResp.length > 0
            ? Math.round(tPrimResp.reduce((a, b) => a + b, 0) / tPrimResp.length)
            : null,
          avgResolucionMs: tResol.length > 0
            ? Math.round(tResol.reduce((a, b) => a + b, 0) / tResol.length)
            : null,
          mensajesEnviados,
          actividadPorHora,
        };
      }),
    );

    // Evolución diaria
    const diasMs = Math.ceil((hasta.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000));
    const evolucionMap: Record<string, { convs: number; resueltas: number }> = {};

    for (let i = 0; i <= diasMs; i++) {
      const d = new Date(desde);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      evolucionMap[key] = { convs: 0, resueltas: 0 };
    }

    todasConvs.forEach(c => {
      const key = new Date(c.ultimoMensajeAt!).toISOString().slice(0, 10);
      if (evolucionMap[key]) {
        evolucionMap[key].convs++;
        if (c.estado === 'resuelta') evolucionMap[key].resueltas++;
      }
    });

    const evolucionDiaria = Object.entries(evolucionMap).map(([fecha, v]) => ({
      fecha,
      convs: v.convs,
      resueltas: v.resueltas,
    }));

    return {
      periodo: { desde, hasta },
      global: { totalConvs, resueltas, avgPrimeraRespuestaMs, avgResolucionMs },
      agentes: agentesData,
      evolucionDiaria,
    };
  }

  async detalleAgente(userId: number, desde: Date, hasta: Date) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, nombre: true, email: true },
    });
    if (!usuario) throw new NotFoundException(`Usuario ${userId} no encontrado`);

    const conversaciones = await this.prisma.waApiConversacion.findMany({
      where: {
        asignadoAId: userId,
        ultimoMensajeAt: { gte: desde, lte: hasta },
      },
      orderBy: { creadoAt: 'desc' },
    });

    const convIds = conversaciones.map(c => c.id);

    const mensajesEnviados = convIds.length > 0
      ? await this.prisma.waApiMensaje.count({
          where: {
            conversacionId: { in: convIds },
            fromMe: true,
            timestamp: { gte: desde, lte: hasta },
          },
        })
      : 0;

    const mensajesPorHora = convIds.length > 0
      ? await this.prisma.waApiMensaje.findMany({
          where: {
            conversacionId: { in: convIds },
            fromMe: true,
            timestamp: { gte: desde, lte: hasta },
          },
          select: { timestamp: true },
        })
      : [];

    const horasCount = new Array(24).fill(0);
    const diasCount = new Array(7).fill(0);
    mensajesPorHora.forEach(m => {
      const d = new Date(m.timestamp);
      horasCount[d.getHours()]++;
      diasCount[d.getDay()]++; // 0=Domingo
    });

    const actividadPorHora = horasCount.map((count, hora) => ({ hora, count }));
    const actividadPorDia = diasCount.map((count, dia) => ({ dia, count }));

    const asignadas = conversaciones.length;
    const resueltas = conversaciones.filter(c => c.estado === 'resuelta').length;
    const activas = conversaciones.filter(c => c.estado === 'asignada').length;

    const tPrimResp = conversaciones
      .filter(c => c.primeraRespuestaAt)
      .map(c => new Date(c.primeraRespuestaAt!).getTime() - new Date(c.creadoAt).getTime());

    const tResol = conversaciones
      .filter(c => c.resolvedAt)
      .map(c => new Date(c.resolvedAt!).getTime() - new Date(c.creadoAt).getTime());

    return {
      usuario,
      metricas: {
        asignadas,
        resueltas,
        activas,
        avgPrimeraRespuestaMs: tPrimResp.length > 0
          ? Math.round(tPrimResp.reduce((a, b) => a + b, 0) / tPrimResp.length)
          : null,
        avgResolucionMs: tResol.length > 0
          ? Math.round(tResol.reduce((a, b) => a + b, 0) / tResol.length)
          : null,
        mensajesEnviados,
      },
      conversaciones: conversaciones.map(c => ({
        id: c.id,
        numero: c.numero,
        nombre: c.nombre,
        estado: c.estado,
        creadoAt: c.creadoAt,
        primeraRespuestaAt: c.primeraRespuestaAt,
        resolvedAt: c.resolvedAt,
        ultimoMensajeAt: c.ultimoMensajeAt,
      })),
      actividadPorHora,
      actividadPorDia,
    };
  }
}
