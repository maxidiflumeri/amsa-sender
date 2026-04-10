import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `Sos un asistente interno de Ana Maya SA, empresa argentina especializada en gestión integral de cobranzas, call center y atención al cliente. Tu rol es ayudar a los agentes del equipo a gestionar conversaciones de WhatsApp con clientes y deudores.

REGLAS ESTRICTAS:
- Respondé SIEMPRE en español argentino, de forma profesional y cordial.
- NUNCA inventes información (medios de pago, precios, datos de empresa, etc.). Usá ÚNICAMENTE la información provista en la base de conocimiento.
- Si el cliente pregunta algo que no está en la base de conocimiento, respondé con algo como "Te consulto con un asesor y te confirmo en breve."
- Cuando haya una campaña activa, priorizá la información de esa campaña por sobre el resto.`;

export interface RespuestaRapidaCtx {
  titulo: string;
  contenido: string;
  tags: string[];
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
  private readonly modelAnalitica: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY no configurada en .env');
    const model = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-1.5-flash';
    this.genAI = new GoogleGenerativeAI(apiKey);
    // Modelo para inbox: temperatura default (más variado, más natural en respuestas)
    this.model = this.genAI.getGenerativeModel({
      model,
      systemInstruction: SYSTEM_PROMPT,
    });
    // Modelo para analítica: temperatura 0 (determinístico, mismos datos = mismo resultado)
    this.modelAnalitica = this.genAI.getGenerativeModel({
      model,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { temperature: 0 },
    });
  }

  async generarResumen(mensajes: { fromMe: boolean; tipo: string; contenido: any; timestamp: Date }[]): Promise<string> {
    const historial = this.formatearMensajes(mensajes);
    if (!historial) return 'No hay mensajes para resumir.';

    const prompt = `Resumí la siguiente conversación de WhatsApp en no más de 5 puntos concisos. Usá viñetas (•). Sé directo, en español argentino, sin saludos ni explicaciones adicionales.\n\nCONVERSACIÓN:\n${historial}`;

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err: any) {
      this.logger.error(`Error generando resumen: ${err.message}`);
      throw err;
    }
  }

  async generarSugerencia(
    mensajes: { fromMe: boolean; tipo: string; contenido: any; timestamp: Date }[],
    contexto: { campañaNombre?: string | null; respuestasRapidas: RespuestaRapidaCtx[] },
  ): Promise<string> {
    const historial = this.formatearMensajes(mensajes);
    if (!historial) return '';

    const baseConocimiento = this.buildBaseConocimiento(contexto);
    const campañaCtx = contexto.campañaNombre
      ? `\nCAMPAÑA ACTIVA: "${contexto.campañaNombre}" — priorizá la información de esta campaña.`
      : '';

    const prompt = `${baseConocimiento}${campañaCtx}

CONVERSACIÓN:
${historial}

Sugerí una respuesta profesional y cordial para el agente basándote en la conversación y la base de conocimiento. Devolvé SOLO el texto de la respuesta, sin comillas, sin explicaciones, sin prefijos.`;

    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err: any) {
      this.logger.error(`Error generando sugerencia: ${err.message}`);
      throw err;
    }
  }

  async generarAnalisisCampania(metrics: any, historial: any[] = []): Promise<string> {
    const c = metrics.conteos;
    const t = metrics.tasas;
    const ti = metrics.tiempos;
    const e = metrics.engagement;
    const cv = metrics.conversaciones;

    const horasPico = (ti.distribucionHorariaLecturas as { hora: number; count: number }[])
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(h => `${h.hora}:00hs (${h.count} lecturas)`)
      .join(', ');

    const erroresTxt = (metrics.errores as { error: string; count: number }[])
      .slice(0, 3)
      .map(err => `"${err.error}" (${err.count} veces)`)
      .join('\n');

    const prompt = `Analizá los siguientes datos de una campaña de WhatsApp y generá un informe completo en español argentino.

CAMPAÑA: "${metrics.campania.nombre}" — Estado: ${metrics.campania.estado}
Enviada: ${metrics.campania.enviadoAt ? new Date(metrics.campania.enviadoAt).toLocaleString('es-AR') : 'no disponible'}
Template: ${metrics.campania.template?.metaNombre ?? 'desconocido'}

DATOS DE ENVÍO:
- Total contactos: ${c.total}
- Enviados: ${c.enviados} | Entregados: ${c.entregados} | Leídos: ${c.leidos} | Fallidos: ${c.fallidos}
- Tasa de entrega: ${t.entrega}% | Tasa de lectura: ${t.lectura}% | Tasa de fallo: ${t.fallo}%
- Tiempo promedio de entrega: ${ti.avgEntregaMs ? Math.round(ti.avgEntregaMs / 1000) + 's' : 'N/D'}
- Tiempo promedio hasta lectura: ${ti.avgLecturaMs ? Math.round(ti.avgLecturaMs / 60000) + ' min' : 'N/D'}
- Horas pico de lectura: ${horasPico || 'sin datos'}

ENGAGEMENT:
- Respondieron: ${e.respondieron} (${c.total > 0 ? Math.round(e.respondieron / c.total * 100) : 0}%)
- Presionaron botón: ${e.presionaronBoton}
- Dieron de baja: ${e.bajas}
- Opciones de botón más elegidas: ${e.payloadBreakdown?.map((p: any) => `"${p.payload}" (${p.count})`).join(', ') || 'ninguna'}

CONVERSACIONES GENERADAS:
- Total: ${cv.total} | Sin asignar: ${cv.sinAsignar} | Asignadas: ${cv.asignadas} | Resueltas: ${cv.resueltas}

ERRORES PRINCIPALES:
${erroresTxt || 'Sin errores relevantes'}
${historial.length > 0 ? `
HISTORIAL DE CAMPAÑAS ANTERIORES (mismo template — para comparación):
${historial.map((h, i) => `${i + 1}. "${h.nombre}" (${h.enviadoAt ? new Date(h.enviadoAt).toLocaleDateString('es-AR') : 'sin fecha'}) — ${h.total} contactos | Lectura: ${h.tasaLectura}% | Engagement: ${h.tasaEngagement}% | Fallos: ${h.tasaFallo}%`).join('\n')}

Usá este historial para comparar el desempeño actual vs campañas anteriores del mismo template. Indicá si mejoró, empeoró o se mantuvo en cada métrica clave.` : '\n(Sin campañas anteriores del mismo template para comparar)'}

Generá el informe con estas secciones exactas usando este formato:
📊 RESUMEN EJECUTIVO
[2-3 párrafos narrativos sobre el desempeño general]

💡 INSIGHTS CLAVE
• [insight 1]
• [insight 2]
• [hasta 5 insights concretos con datos]

⚠️ ALERTAS
• [alerta 1 si aplica]
• [ninguna si todo está bien]

🎯 RECOMENDACIONES
1. [acción concreta y específica]
2. [acción concreta y específica]
3. [hasta 4 recomendaciones]`;

    try {
      const result = await this.modelAnalitica.generateContent(prompt);
      return result.response.text().trim();
    } catch (err: any) {
      this.logger.error(`Error generando análisis campaña: ${err.message}`);
      throw err;
    }
  }

  async generarAnalisisAgentes(metrics: any): Promise<string> {
    const g = metrics.global;
    const agentes = metrics.agentes as any[];

    const mejorRespuesta = [...agentes]
      .filter(a => a.avgPrimeraRespuestaMs)
      .sort((a, b) => a.avgPrimeraRespuestaMs - b.avgPrimeraRespuestaMs)[0];
    const peorRespuesta = [...agentes]
      .filter(a => a.avgPrimeraRespuestaMs)
      .sort((a, b) => b.avgPrimeraRespuestaMs - a.avgPrimeraRespuestaMs)[0];
    const mayorVolumen = [...agentes].sort((a, b) => b.asignadas - a.asignadas)[0];
    const sinActividad = agentes.filter(a => a.mensajesEnviados === 0);

    const horaGlobalPico = agentes
      .flatMap(a => a.actividadPorHora ?? [])
      .reduce((acc: Record<number, number>, h: any) => {
        acc[h.hora] = (acc[h.hora] ?? 0) + h.count;
        return acc;
      }, {});
    const horaPicoEntry = Object.entries(horaGlobalPico).sort((a, b) => +(b[1] as number) - +(a[1] as number))[0];
    const horaPico = horaPicoEntry ? `${horaPicoEntry[0]}:00hs` : 'N/D';

    const resumenAgentes = agentes.map(a =>
      `- ${a.nombre}: ${a.asignadas} asignadas, ${a.resueltas} resueltas, ${a.mensajesEnviados} msgs enviados, primera respuesta avg ${a.avgPrimeraRespuestaMs ? Math.round(a.avgPrimeraRespuestaMs / 60000) + 'min' : 'N/D'}, resolución avg ${a.avgResolucionMs ? Math.round(a.avgResolucionMs / 3600000) + 'h' : 'N/D'}`
    ).join('\n');

    const prompt = `Analizá el desempeño del equipo de agentes de WhatsApp y generá un informe en español argentino.

PERÍODO: ${new Date(metrics.periodo.desde).toLocaleDateString('es-AR')} al ${new Date(metrics.periodo.hasta).toLocaleDateString('es-AR')}

MÉTRICAS GLOBALES:
- Total conversaciones: ${g.totalConvs} | Resueltas: ${g.resueltas} (${g.totalConvs > 0 ? Math.round(g.resueltas / g.totalConvs * 100) : 0}%)
- Tiempo promedio de primera respuesta: ${g.avgPrimeraRespuestaMs ? Math.round(g.avgPrimeraRespuestaMs / 60000) + ' min' : 'N/D'}
- Tiempo promedio de resolución: ${g.avgResolucionMs ? Math.round(g.avgResolucionMs / 3600000) + ' hs' : 'N/D'}
- Hora pico de actividad del equipo: ${horaPico}

POR AGENTE:
${resumenAgentes}

DESTACADOS:
- Mejor tiempo de respuesta: ${mejorRespuesta ? `${mejorRespuesta.nombre} (${Math.round(mejorRespuesta.avgPrimeraRespuestaMs / 60000)}min avg)` : 'N/D'}
- Peor tiempo de respuesta: ${peorRespuesta ? `${peorRespuesta.nombre} (${Math.round(peorRespuesta.avgPrimeraRespuestaMs / 60000)}min avg)` : 'N/D'}
- Mayor volumen: ${mayorVolumen ? `${mayorVolumen.nombre} (${mayorVolumen.asignadas} convs)` : 'N/D'}
- Sin actividad: ${sinActividad.length > 0 ? sinActividad.map(a => a.nombre).join(', ') : 'ninguno'}

Generá el informe con estas secciones exactas:
👥 RESUMEN DEL EQUIPO
[2-3 párrafos sobre el desempeño general del período]

🏆 DESTACADOS
• [mejor rendimiento con datos concretos]
• [logros del equipo]

🔴 ATENCIÓN
• [agentes que necesitan atención o mejora — con datos]
• [ninguno si todo está bien]

📈 PATRONES
• [patrones de actividad, horas, días]
• [tendencias observadas]

🎯 RECOMENDACIONES
1. [acción concreta para el equipo o líderes]
2. [hasta 4 recomendaciones]`;

    try {
      const result = await this.modelAnalitica.generateContent(prompt);
      return result.response.text().trim();
    } catch (err: any) {
      this.logger.error(`Error generando análisis agentes: ${err.message}`);
      throw err;
    }
  }

  private buildBaseConocimiento(ctx: { campañaNombre?: string | null; respuestasRapidas: RespuestaRapidaCtx[] }): string {
    if (!ctx.respuestasRapidas.length) return '';

    // Separar las RR que coinciden con la campaña activa de las generales
    const campañaLower = ctx.campañaNombre?.toLowerCase() ?? '';
    const delaCampaña = campañaLower
      ? ctx.respuestasRapidas.filter(r => r.tags.some(t => t.toLowerCase().includes(campañaLower) || campañaLower.includes(t.toLowerCase())))
      : [];
    const generales = ctx.respuestasRapidas.filter(r => !delaCampaña.includes(r));

    const lines: string[] = ['BASE DE CONOCIMIENTO (usá esta información en tus respuestas):'];

    if (delaCampaña.length) {
      lines.push(`\n— Información específica de la campaña "${ctx.campañaNombre}":`);
      delaCampaña.forEach(r => lines.push(`  [${r.titulo}]: ${r.contenido}`));
    }

    if (generales.length) {
      lines.push('\n— Información general:');
      generales.forEach(r => lines.push(`  [${r.titulo}]: ${r.contenido}`));
    }

    return lines.join('\n');
  }

  private formatearMensajes(mensajes: { fromMe: boolean; tipo: string; contenido: any; timestamp: Date }[]): string {
    return mensajes
      .filter(m => m.tipo !== 'sistema')
      .slice(-40)
      .map(m => {
        const quien = m.fromMe ? 'AGENTE' : 'CLIENTE';
        const texto = m.contenido?.text ?? `[${m.tipo}]`;
        return `${quien}: ${texto}`;
      })
      .join('\n');
  }
}
