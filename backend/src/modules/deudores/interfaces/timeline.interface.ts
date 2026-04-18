export interface TimelineEntry {
  id: string;
  canal: 'whatsapp' | 'email' | 'wapi';
  tipo: string;
  fecha: Date;
  detalle: {
    asunto?: string;
    mensaje?: string;
    templateNombre?: string;
    estado: string;
    error?: string;
    urlDestino?: string;
  };
  campaniaId: number | null;
  campaniaNombre: string | null;
  contactoId: number;
}

export interface DeudorListItem {
  id: number;
  idDeudor: number | null;
  nombre: string | null;
  documento: string | null;
  empresa: string | null;
  nroEmpresa: string | null;
  remesa: string | null;
  canales: { whatsapp: number; email: number; wapi: number };
}

export interface DeudorFicha {
  id: number;
  idDeudor: number | null;
  nombre: string | null;
  documento: string | null;
  empresa: string | null;
  nroEmpresa: string | null;
  remesa: string | null;
  datos: Record<string, unknown> | null;
  creadoEn: Date;
  actualizadoEn: Date;
  canales: {
    telefonos: string[];
    emails: string[];
  };
}

export interface ReporteEmpresa {
  empresa: string;
  totalDeudores: number;
  contactosPorCanal: { whatsapp: number; email: number; wapi: number };
  envios: { whatsapp: number; email: number; wapi: number };
  email: {
    entregados: number;
    abiertos: number;
    clicks: number;
    rebotes: number;
    tasaApertura: number;
    tasaClick: number;
  };
  wapi: {
    entregados: number;
    leidos: number;
    fallidos: number;
    tasaEntrega: number;
    tasaLectura: number;
  };
}

export interface ReporteRemesa extends ReporteEmpresa {
  remesa: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}
