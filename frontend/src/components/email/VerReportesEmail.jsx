// CampaignEngagementPage.jsx
// Vista moderna para aperturas y clics por campaña
// Stack: React + Material UI (+ opcional Recharts para minigráficas)

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Link,
  Modal,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Drawer,
  Button,
  Skeleton
} from '@mui/material';
import { DateRange } from '@mui/icons-material';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import BarChartIcon from '@mui/icons-material/BarChart';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Area, AreaChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import DownloadIcon from '@mui/icons-material/Download';

// ⬇️ NUEVO: DatePicker
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import "dayjs/locale/es";

// =====================================================
// Helpers de API (axios reales)
// =====================================================
import api from '../../api/axios';
// tamaño y truncado homogéneo
const ELLIPSIS_1LINE = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };
const CARD_MIN_HEIGHT = 320; // ajustá 280–340 si querés

async function apiFetchOverview({ since, until, query, page = 0, size = 12 }) {
  const params = new URLSearchParams();
  if (since) params.append('since', since);
  if (until) params.append('until', until);
  if (query) params.append('q', query);
  params.append('includeSparkline', 'true');
  params.append('page', String(page));
  params.append('size', String(size));

  const { data } = await api.get(`/email/reportes/overview?${params.toString()}`);
  return {
    total: data.total,
    items: (data.items || []).map((c) => ({
      ...c,
      sparkline: (c.sparkline || []).map((p) => ({
        t: p.day,
        abiertos: Number(p.abiertos),
        clics: Number(p.clics),
      })),
    })),
  };
}

function SkeletonSparklineCard() {
  return (
    <Card
      sx={{
        height: '100%',
        width: '100%',
        minHeight: CARD_MIN_HEIGHT,
        borderRadius: 3,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        p: 0
      }}
    >
      <CardHeader
        sx={{ px: 2, py: 1.25, '& .MuiCardHeader-content': { minWidth: 0 } }}
        title={<Skeleton variant="text" width="60%" height={28} />}
        subheader={<Skeleton variant="text" width="40%" />}
        action={
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" height={24} width={100} />
            <Skeleton variant="rounded" height={24} width={90} />
          </Stack>
        }
      />
      <CardContent
        sx={{
          px: 2, pt: 0.5, pb: 2,
          display: 'flex', flexDirection: 'column', gap: 1.5, flexGrow: 1
        }}
      >
        <Box sx={{ height: 120 }}>
          <Skeleton variant="rounded" width="100%" height="100%" />
        </Box>

        <Stack spacing={1} sx={{ mt: 1 }}>
          <Skeleton variant="text" width="35%" />
          <Skeleton variant="text" width="55%" />
          <Skeleton variant="text" width="45%" />
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        <Divider sx={{ my: 1.25 }} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Skeleton variant="rounded" width={120} height={32} />
        </Box>
      </CardContent>
    </Card>
  );
}

async function apiFetchCampaignDetail(campaniaId, { since, until, pageOpen = 0, sizeOpen = 10, pageClick = 0, sizeClick = 10, pageBounce = 0, sizeBounce = 10 } = {}) {
  const params = new URLSearchParams();
  if (since) params.append('since', since);
  if (until) params.append('until', until);
  params.append('pageOpen', String(pageOpen));
  params.append('sizeOpen', String(sizeOpen));
  params.append('pageClick', String(pageClick));
  params.append('sizeClick', String(sizeClick));
  params.append('pageBounce', String(pageBounce));
  params.append('sizeBounce', String(sizeBounce));
  const { data } = await api.get(`/email/reportes/campanias/${campaniaId}/engagement?${params.toString()}`);
  return {
    ...data,
    // normalización defensiva si backend aún no envía el array
    rebotes: Array.isArray(data.rebotes) ? data.rebotes : [],
  };
}

// ⬇️ NUEVO: eventos por fecha (reemplaza el "today")
async function apiFetchEventsByDate({ date, limit = 200, afterId } = {}) {
  // Si ya tenés un endpoint /email/reportes/events?date=YYYY-MM-DD lo usamos:
  // const { data } = await api.get('/email/reportes/events', { params: { date, limit, afterId } });
  // return data;

  // Si aún no existe, podés seguir usando el actual de "today" mientras adaptás backend:
  // pero idealmente movelo al endpoint por fecha.
  const params = new URLSearchParams();
  params.append('limit', String(limit));
  if (afterId) params.append('afterId', String(afterId));
  // TEMP: endpoint actual "today" (mientras migrás backend)
  const { data } = await api.get(`/email/reportes/events/by-date`, { params: { date, limit, afterId } });
  return data;
}

// =====================================================
// Componentes auxiliares
// =====================================================
function Metric({ label, value, help }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body1" fontWeight={600}>{value}</Typography>
      {help && (
        <Tooltip title={help}><InfoOutlinedIcon fontSize="small" /></Tooltip>
      )}
    </Stack>
  );
}

function SparklineCard({ title, subtitle, openRate, clickRate, enviados, data, onOpenDetail }) {
  const openPct = Math.round((openRate || 0) * 100);
  const clickPct = Math.round((clickRate || 0) * 100);

  return (
    <Card
      sx={{
        width: '100%',
        height: '100%',
        minHeight: CARD_MIN_HEIGHT,             // 🔒 alto uniforme
        borderRadius: 3,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        p: 0                                      // compacta
      }}
    >
      <CardHeader
        sx={{
          px: 2, py: 1.25,                        // header más chico
          '& .MuiCardHeader-content': { minWidth: 0 }
        }}
        title={
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ mr: 1, ...ELLIPSIS_1LINE }}>{title}</Typography>
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <Chip size="small" label={`Aperturas ${openPct}%`} color={openPct >= 50 ? 'success' : 'default'} />
              <Chip size="small" label={`Clicks ${clickPct}%`} color={clickPct >= 10 ? 'primary' : 'default'} />
            </Stack>
          </Stack>
        }
        subheader={
          <Typography variant="body2" color="text.secondary" sx={{ ...ELLIPSIS_1LINE }}>
            {subtitle}
          </Typography>
        }
      />
      <CardContent
        sx={{
          px: 2, pt: 0.5, pb: 2,                  // contenido compacto
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          flexGrow: 1,
          minWidth: 0
        }}
      >
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={7}>
            <Box sx={{ height: 120 }}>           {/* altura fija del gráfico */}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gOpen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="currentColor" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gClick" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="currentColor" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" hide />
                  <YAxis hide />
                  <RTooltip formatter={(val, name) => [val, name === 'abiertos' ? 'Aperturas' : 'Clicks']} labelFormatter={(l) => `Período ${l}`} />
                  <Area type="monotone" dataKey="abiertos" strokeWidth={2} stroke="currentColor" fillOpacity={1} fill="url(#gOpen)" />
                  <Area type="monotone" dataKey="clics" strokeWidth={1.75} stroke="currentColor" fillOpacity={1} fill="url(#gClick)" />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack spacing={1}>
              <Metric label="Enviados" value={enviados} />
              <Metric label="Tasa de apertura" value={`${openPct}%`} help="Aperturas únicas / Enviados" />
              <Metric label="Tasa de click" value={`${clickPct}%`} help="Clics únicos / Enviados" />
            </Stack>
          </Grid>
        </Grid>

        <Box sx={{ flexGrow: 1 }} />             {/* empuja footer → altura pareja */}

        <Divider sx={{ my: 1.25 }} />
        <Stack direction="row" justifyContent="flex-end">
          <Button variant="outlined" size="small" startIcon={<BarChartIcon />} onClick={onOpenDetail}>
            Ver detalle
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function EventsTable({ rows, columns, page, rowsPerPage, onPageChange, onRowsPerPageChange, emptyLabel }) {
  const start = page * rowsPerPage;
  const end = start + rowsPerPage;
  const paginated = rows.slice(start, end);

  return (
    <>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map(col => (
                <TableCell key={col.key} sx={{ whiteSpace: 'nowrap' }}>
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center">
                  <Typography variant="body2" color="text.secondary">{emptyLabel}</Typography>
                </TableCell>
              </TableRow>
            )}
            {paginated.map((row) => (
              <TableRow key={row.id} hover>
                {columns.map(col => (
                  <TableCell key={col.key}>
                    {typeof col.render === 'function' ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={rows.length}
        page={page}
        onPageChange={(_, p) => onPageChange(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[10, 25, 50]}
      />
    </>
  );
}

function RightDetailDrawer({ open, onClose, campania, detail, onPaginate }) {
  const [tab, setTab] = useState(0);
  const [pageOpen, setPageOpen] = useState(0);
  const [pageClick, setPageClick] = useState(0);
  const [rppOpen, setRppOpen] = useState(10);
  const [rppClick, setRppClick] = useState(10);
  const [pageBounce, setPageBounce] = useState(0);
  const [rppBounce, setRppBounce] = useState(10);
  const [bounceDialog, setBounceDialog] = useState({ open: false, row: null })

  useEffect(() => {
    if (open) { setTab(0); setPageOpen(0); setPageClick(0); setPageBounce(0) }
  }, [open]);

  const colsOpens = [
    { key: 'timestamp', label: 'Fecha/Hora', render: v => new Date(v).toLocaleString() },
    { key: 'email', label: 'Email' },
    { key: 'ip', label: 'IP' },
    { key: 'userAgent', label: 'Agente' },
  ];

  const colsClicks = [
    { key: 'timestamp', label: 'Fecha/Hora', render: v => new Date(v).toLocaleString() },
    { key: 'email', label: 'Email' },
    {
      key: 'url', label: 'URL', render: v => (
        <Link href={v} target="_blank" rel="noopener noreferrer">
          {v}<OpenInNewIcon sx={{ ml: 0.5, fontSize: 16 }} />
        </Link>
      )
    },
    { key: 'ip', label: 'IP' },
    { key: 'userAgent', label: 'Agente' },
  ];

  const colsBounces = [
    { key: 'timestamp', label: 'Fecha/Hora', render: v => new Date(v).toLocaleString() },
    { key: 'email', label: 'Email' },
    { key: 'codigo', label: 'Código' },
    {
      key: 'descripcion',
      label: 'Descripción',
      render: (v, row) => (
        <Box
          sx={{
            maxWidth: { xs: 280, sm: 420, md: 680 },   // ajustá a gusto
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',                  // fuerza corte en palabras largas
            display: '-webkit-box',
            WebkitLineClamp: 3,                        // 3 líneas visibles
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {v ?? '-'}
          {v && v.length > 200 && (
            <Button
              variant="text"
              size="small"
              sx={{ ml: 1, p: 0 }}
              onClick={() => setBounceDialog({ open: true, row })}
            >
              Ver más
            </Button>
          )}
        </Box>
      )
    },
  ];

  return (
    <>
      <Modal open={bounceDialog.open} onClose={() => setBounceDialog({ open: false, row: null })}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '90%', md: 700 },
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
            maxHeight: '70vh',
            overflow: 'auto',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6">Descripción completa</Typography>
            <IconButton onClick={() => setBounceDialog({ open: false, row: null })}>
              <CloseIcon />
            </IconButton>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {bounceDialog.row?.email ?? ''}
          </Typography>

          <Box
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              p: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
            }}
          >
            {bounceDialog.row?.descripcion ?? '-'}
          </Box>
        </Box>
      </Modal>

      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        variant="temporary"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 2,
          '& .MuiPaper-root': {
            width: { xs: '100%', md: 640 },
          },
        }}
        ModalProps={{ keepMounted: true }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6">Detalle de campaña</Typography>
              <Typography variant="body2" color="text.secondary">{campania?.nombre}</Typography>
            </Box>
            <IconButton onClick={onClose}><CloseIcon /></IconButton>
          </Stack>
          <Divider sx={{ my: 2 }} />

          {!detail && (
            <>
              <LinearProgress />
              <Typography variant="body2" sx={{ mt: 1 }} color="text.secondary">Cargando detalle…</Typography>
            </>
          )}

          {detail && (
            <>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={4}><Chip label={`Enviados ${detail.resumen.enviados}`} /></Grid>
                <Grid item xs={6} sm={4}><Chip color="success" label={`Aperturas únicas ${detail.resumen.abiertosUnicos}`} /></Grid>
                <Grid item xs={6} sm={4}><Chip color="primary" label={`Clicks únicos ${detail.resumen.clicsUnicos}`} /></Grid>
                <Grid item xs={6} sm={4}><Chip color="warning" label={`Rebotes ${detail.resumen.rebotes}`} /></Grid>
                {detail.resumen.primeroAbierto && (
                  <Grid item xs={12}><Chip variant="outlined" label={`Primera apertura ${new Date(detail.resumen.primeroAbierto).toLocaleString()}`} /></Grid>
                )}
                {detail.resumen.primeroClick && (
                  <Grid item xs={12}><Chip variant="outlined" label={`Primer click ${new Date(detail.resumen.primeroClick).toLocaleString()}`} /></Grid>
                )}
              </Grid>

              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 2 }}>
                <Tab label={`Aperturas (${detail.aperturas.length})`} />
                <Tab label={`Clicks (${detail.clicks.length})`} />
                <Tab label={`Rebotes (${detail.rebotes?.length ?? 0})`} />
              </Tabs>

              <Box hidden={tab !== 0} sx={{ mt: 2 }}>
                <EventsTable
                  rows={detail.aperturas}
                  columns={colsOpens}
                  page={pageOpen}
                  rowsPerPage={rppOpen}
                  onPageChange={(p) => { setPageOpen(p); onPaginate?.({ pageOpen: p, sizeOpen: rppOpen }); }}
                  onRowsPerPageChange={(size) => { setRppOpen(size); setPageOpen(0); onPaginate?.({ pageOpen: 0, sizeOpen: size }); }}
                  emptyLabel="Sin aperturas registradas"
                />
              </Box>

              <Box hidden={tab !== 1} sx={{ mt: 2 }}>
                <EventsTable
                  rows={detail.clicks}
                  columns={colsClicks}
                  page={pageClick}
                  rowsPerPage={rppClick}
                  onPageChange={(p) => { setPageClick(p); onPaginate?.({ pageClick: p, sizeClick: rppClick }); }}
                  onRowsPerPageChange={(size) => { setRppClick(size); setPageClick(0); onPaginate?.({ pageClick: 0, sizeClick: size }); }}
                  emptyLabel="Sin clics registrados"
                />
              </Box>

              <Box hidden={tab !== 2} sx={{ mt: 2 }}>
                <EventsTable
                  rows={detail.rebotes ?? []}
                  columns={colsBounces}
                  page={pageBounce}
                  rowsPerPage={rppBounce}
                  onPageChange={(p) => { setPageBounce(p); onPaginate?.({ pageBounce: p, sizeBounce: rppBounce }); }}
                  onRowsPerPageChange={(size) => { setRppBounce(size); setPageBounce(0); onPaginate?.({ pageBounce: 0, sizeBounce: size }); }}
                  emptyLabel="Sin rebotes registrados"
                />
              </Box>
            </>
          )}
        </Box>
      </Drawer>
    </>
  );
}

// =====================================================
// Página principal
// =====================================================
export default function CampaignEngagementPage() {
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [range, setRange] = useState('hoy'); // hoy | 7d | 30d
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailParams, setDetailParams] = useState({ pageOpen: 0, sizeOpen: 10, pageClick: 0, sizeClick: 10, pageBounce: 0, sizeBounce: 10 });
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [page, setPage] = useState(0);     // página 0-based
  const [size, setSize] = useState(12);    // tarjetas por página
  const [total, setTotal] = useState(0);   // total de campañas
  // ⬇️ NUEVO: rebotes por fecha
  const [rebotes, setRebotes] = useState([]);
  const [loadingRebotes, setLoadingRebotes] = useState(false);
  const [pageEvents, setPageEvents] = useState(0);
  const [rppEvents, setRppEvents] = useState(25);
  const [pageRebotes, setPageRebotes] = useState(0);
  const [rppRebotes, setRppRebotes] = useState(25);
  const [reboteDialog, setReboteDialog] = useState({ open: false, row: null });

  // paginados memorizados
  const paginatedEvents = useMemo(() => {
    const start = pageEvents * rppEvents;
    return events.slice(start, start + rppEvents);
  }, [events, pageEvents, rppEvents]);
  const paginatedRebotes = useMemo(() => {
    const start = pageRebotes * rppRebotes;
    return rebotes.slice(start, start + rppRebotes);
  }, [rebotes, pageRebotes, rppRebotes]);


  // ⬇️ NUEVO: fecha seleccionada para eventos
  const [selectedDate, setSelectedDate] = useState(dayjs()); // default hoy

  // resetear página cuando cambian los datos o la fecha elegida
  useEffect(() => { setPageEvents(0); }, [events, selectedDate]);
  useEffect(() => { setPageRebotes(0); }, [rebotes, selectedDate]);

  const dates = useMemo(() => {
    const now = new Date();
    const end = toLocalISOString(now);
    const startDate = new Date(now);
    if (range === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (range === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else {
      startDate.setHours(0, 0, 0, 0);
    }
    const start = toLocalISOString(startDate, true);
    return { since: start, until: end };
  }, [range]);

  function toLocalISOString(date, start = false) {
    const pad = (n) => String(n).padStart(2, '0');

    if (start) {
      return (
        date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes()) +
        ':' + pad(date.getSeconds())
      );
    }

    return (
      date.getFullYear() +
      '-' + pad(date.getMonth() + 1) +
      '-' + pad(date.getDate()) +
      'T' + pad('23') +
      ':' + pad('59') +
      ':' + pad('59')
    );
  }

  // ⬇️ util: start/end del día para CSV (en local time)
  function startEndOfDay(d) {
    const js = d.toDate(); // dayjs -> Date
    const start = new Date(js);
    start.setHours(0, 0, 0, 0);
    const end = new Date(js);
    end.setHours(23, 59, 59, 999);

    return { desde: toLocalISOString(start, true), hasta: toLocalISOString(end) };
  }

  const loadOverview = async () => {
    setLoading(true);
    try {
      const { total, items } = await apiFetchOverview({ ...dates, query, page, size });
      setTotal(total);
      setOverview(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, page, size]);

  const handlePaginateDetail = async (patch) => {
    if (!selectedCampaign) return;
    const params = { ...detailParams, ...patch };
    setDetailParams(params);
    setDetail(null);
    const d = await apiFetchCampaignDetail(
      selectedCampaign.id,
      { since: dates.since, until: dates.until, ...params }
    );
    setDetail(d);
  };

  // ⬇️ NUEVO: carga eventos según fecha seleccionada
  const loadEventsByDate = async () => {
    setLoadingEvents(true);
    try {
      const dateParam = selectedDate.format('YYYY-MM-DD');
      const data = await apiFetchEventsByDate({ date: dateParam, limit: 500000 });
      setEvents(data);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (tab === 1) loadEventsByDate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (tab === 2) loadRebotesByDate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedDate]);

  const openDetail = async (campania) => {
    setSelectedCampaign(campania);
    setDrawerOpen(true);
    setDetail(null);
    const defaults = { pageOpen: 0, sizeOpen: 10, pageClick: 0, sizeClick: 10, pageBounce: 0, sizeBounce: 10 };
    setDetailParams(defaults);
    const d = await apiFetchCampaignDetail(campania.id, { since: dates.since, until: dates.until, ...defaults });
    setDetail(d);
  };

  // ⬇️ NUEVO: descarga CSV de la fecha seleccionada
  const downloadCsvSelectedDate = async () => {
    try {
      const { desde, hasta } = startEndOfDay(selectedDate);
      const res = await api.get('/email/reportes/actividades.csv', {
        params: { desde, hasta, tipo: 'all' },
        responseType: 'blob',
      });

      const cd = res.headers?.['content-disposition'] || '';
      const match = /filename="?([^"]+)"?/i.exec(cd);
      const fallbackName = `actividades_${selectedDate.format('YYYY-MM-DD')}.csv`;
      const filename = match?.[1] || fallbackName;

      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error al descargar CSV:', err);
    }
  };

  // ⬇️ NUEVO: rebotes por fecha (JSON)
  async function apiFetchRebotesByDate({ date, limit = 200, afterId } = {}) {
    const { data } = await api.get(`/email/reportes/rebotes/by-date`, {
      params: { date, limit, afterId }
    });
    return data; // [{ id, timestamp, email, código/descripcion, campañaNombre, ... }]
  }

  // ⬇️ NUEVO: descarga CSV de rebotes por fecha
  async function apiDownloadCsvRebotes({ desde, hasta }) {
    return api.get('/email/reportes/rebotes.csv', {
      params: { desde, hasta },
      responseType: 'blob',
    });
  }

  // ⬇️ NUEVO: carga rebotes según fecha seleccionada
  const loadRebotesByDate = async () => {
    setLoadingRebotes(true);
    try {
      const dateParam = selectedDate.format('YYYY-MM-DD');
      const data = await apiFetchRebotesByDate({ date: dateParam, limit: 500000 });
      setRebotes(data);
    } finally {
      setLoadingRebotes(false);
    }
  };

  // ⬇️ NUEVO: descarga CSV de rebotes para la fecha seleccionada
  const downloadCsvRebotesSelectedDate = async () => {
    try {
      const { desde, hasta } = startEndOfDay(selectedDate);
      const res = await apiDownloadCsvRebotes({ desde, hasta });

      const cd = res.headers?.['content-disposition'] || '';
      const match = /filename="?([^"]+)"?/i.exec(cd);
      const filename = match?.[1] || `rebotes_${selectedDate.format('YYYY-MM-DD')}.csv`;

      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error al descargar CSV de rebotes:', err);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box display="flex" alignItems="center">
          <BarChartIcon sx={{ fontSize: 32 }} />
          <Typography ml={1} variant="h5" fontWeight="bold">Reportes de Email</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="Buscar campaña…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(0);
                loadOverview();
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          <TextField
            size="small"
            select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            SelectProps={{ native: true }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><DateRange /></InputAdornment>
              )
            }}
          >
            <option value="hoy">Hoy</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
          </TextField>
          <Button
            variant="contained"
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              backgroundColor: '#075E54',
              '&:hover': {
                backgroundColor: '#0b7b65',
                transform: 'scale(1.03)',
                boxShadow: 4,
              },
            }}
            onClick={() => {
              setPage(0);
              loadOverview();
            }}
          >
            Actualizar
          </Button>
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Resumen por campaña" />
        <Tab label="Aperturas y clics (por fecha)" />
        <Tab label="Rebotes (por fecha)" />
      </Tabs>

      {tab === 0 && (
        <>
          {loading && (
            <>
              <Box sx={{ mb: 2 }}><LinearProgress /></Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', md: 'repeat(3, minmax(0,1fr))' },
                  gap: 1.5
                }}
              >
                {Array.from({ length: size || 12 }).map((_, i) => (
                  <Box key={`sk-${i}`} sx={{ display: 'flex', minWidth: 0 }}>
                    <SkeletonSparklineCard />
                  </Box>
                ))}
              </Box>
            </>
          )}

          {!loading && overview.length === 0 && (
            <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
              <Typography variant="body1">Sin campañas para el período seleccionado.</Typography>
            </Paper>
          )}

          {/* 🔒 3 columnas; gap más chico para que se vean "más juntas" */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', md: 'repeat(3, minmax(0,1fr))' },
              gap: 1.5                                         // ↓ probá 1 si querés aún más juntas
            }}
          >
            {overview.map((c) => (
              <Box key={c.id} sx={{ display: 'flex', minWidth: 0 }}>
                <SparklineCard
                  title={c.nombre}
                  subtitle={`${c.enviados} enviados`}
                  openRate={c.tasaApertura}
                  clickRate={c.tasaClick}
                  enviados={c.enviados}
                  data={c.sparkline}
                  onOpenDetail={() => openDetail(c)}
                />
              </Box>
            ))}
          </Box>

          {!loading && total > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <TablePagination
                component="div"
                count={total}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={size}
                onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[6, 12, 24, 48]}
                labelRowsPerPage="Tarjetas por página"
              />
            </Box>
          )}
        </>
      )}

      {tab === 1 && (
        <Card sx={{ borderRadius: 3 }}>
          <CardHeader
            title={`Eventos del ${selectedDate.format('YYYY-MM-DD')}`}
            subheader="Aperturas y clics más recientes en todas las campañas"
            action={
              <Stack direction="row" spacing={1} alignItems="center">
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
                  <DatePicker
                    label="Fecha"
                    value={selectedDate}
                    onChange={(v) => v && setSelectedDate(v)}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                </LocalizationProvider>
                <Button variant="outlined" size="small" onClick={loadEventsByDate}>
                  Actualizar
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={downloadCsvSelectedDate}
                >
                  Descargar CSV
                </Button>
              </Stack>
            }
          />
          <CardContent>
            {loadingEvents && <LinearProgress />}

            {!loadingEvents && (
              <>
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Hora</TableCell>
                        <TableCell>Campaña</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Tipo</TableCell>
                        <TableCell>URL</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {events.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="body2" color="text.secondary">Sin eventos registrados en la fecha.</Typography>
                          </TableCell>
                        </TableRow>
                      )}

                      {paginatedEvents.map(ev => (
                        <TableRow key={ev.id} hover>
                          <TableCell>{new Date(ev.timestamp).toLocaleTimeString()}</TableCell>
                          <TableCell>{ev.campañaNombre ?? `Campaña ${ev.campañaId}`}</TableCell>
                          <TableCell>{ev.email}</TableCell>
                          <TableCell>
                            <Chip size="small" label={ev.tipo} color={ev.tipo === 'OPEN' ? 'success' : 'primary'} />
                          </TableCell>
                          <TableCell>
                            {ev.url ? (
                              <Link href={ev.url} target="_blank" rel="noopener noreferrer">
                                {ev.url}<OpenInNewIcon sx={{ ml: 0.5, fontSize: 16 }} />
                              </Link>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <TablePagination
                    component="div"
                    count={events.length}
                    page={pageEvents}
                    onPageChange={(_, p) => setPageEvents(p)}
                    rowsPerPage={rppEvents}
                    onRowsPerPageChange={(e) => { setRppEvents(parseInt(e.target.value, 10)); setPageEvents(0); }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    labelRowsPerPage="Filas por página"
                  />
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card sx={{ borderRadius: 3 }}>
          <CardHeader
            title={`Rebotes del ${selectedDate.format('YYYY-MM-DD')}`}
            subheader="Rebotes más recientes en todas las campañas"
            action={
              <Stack direction="row" spacing={1} alignItems="center">
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
                  <DatePicker
                    label="Fecha"
                    value={selectedDate}
                    onChange={(v) => v && setSelectedDate(v)}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                </LocalizationProvider>
                <Button variant="outlined" size="small" onClick={loadRebotesByDate}>
                  Actualizar
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={downloadCsvRebotesSelectedDate}
                >
                  Descargar CSV
                </Button>
              </Stack>
            }
          />
          <CardContent>
            {loadingRebotes && <LinearProgress />}

            {!loadingRebotes && (
              <>
                <TableContainer
                  component={Paper}
                  variant="outlined"
                  sx={{ borderRadius: 2, overflowX: 'auto' }}   // scroll horizontal defensivo
                >
                  <Table
                    size="small"
                    sx={{
                      tableLayout: 'fixed',                      // evita que crezca por strings largas
                      minWidth: 900,                             // ajustá si querés
                      '& td, & th': { fontSize: '0.9rem' },     // opcional: tipografía más chica
                    }}
                  >
                    {/* ancho sugerido por columna */}
                    <colgroup>
                      <col style={{ width: 110 }} />            {/* Hora */}
                      <col style={{ width: 180 }} />            {/* Campaña */}
                      <col style={{ width: 240 }} />            {/* Email */}
                      <col style={{ width: 90 }} />             {/* Código */}
                      <col />                                   {/* Descripción (toma el resto) */}
                    </colgroup>

                    <TableHead>
                      <TableRow>
                        <TableCell>Hora</TableCell>
                        <TableCell>Campaña</TableCell>
                        <TableCell>Email</TableCell>
                        <TableCell>Código</TableCell>
                        <TableCell>Descripción</TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {rebotes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="body2" color="text.secondary">
                              Sin rebotes registrados en la fecha.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}

                      {paginatedRebotes.map((rb) => (
                        <TableRow key={rb.id} hover>
                          <TableCell>{new Date(rb.timestamp).toLocaleTimeString()}</TableCell>
                          <TableCell>{rb.campañaNombre ?? (rb.campañaId ? `Campaña ${rb.campañaId}` : '-')}</TableCell>
                          <TableCell>{rb.email}</TableCell>
                          <TableCell>{rb.codigo ?? '-'}</TableCell>

                          {/* DESCRIPCIÓN CLAMP + VER MÁS */}
                          <TableCell
                            sx={{
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                              p: 1,
                            }}
                          >
                            {/* Texto clamped a 3 líneas */}
                            <Box
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {rb.descripcion ?? '-'}
                            </Box>

                            {/* Botón fuera del clamp (si el texto es largo) */}
                            {rb.descripcion && rb.descripcion.length > 120 && (
                              <Box sx={{ mt: 0.5, textAlign: 'right' }}>
                                <Button
                                  variant="text"
                                  size="small"
                                  onClick={() => setReboteDialog({ open: true, row: rb })}
                                  sx={{ p: 0 }}
                                >
                                  Ver más
                                </Button>
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <TablePagination
                    component="div"
                    count={rebotes.length}
                    page={pageRebotes}
                    onPageChange={(_, p) => setPageRebotes(p)}
                    rowsPerPage={rppRebotes}
                    onRowsPerPageChange={(e) => {
                      setRppRebotes(parseInt(e.target.value, 10));
                      setPageRebotes(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    labelRowsPerPage="Filas por página"
                  />
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <RightDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        campania={selectedCampaign}
        detail={detail}
        onPaginate={handlePaginateDetail}
      />
      <Modal
        open={reboteDialog.open}
        onClose={() => setReboteDialog({ open: false, row: null })}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '92%', md: 760 },
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
            maxHeight: '75vh',
            overflow: 'auto',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6">Descripción del rebote</Typography>
            <IconButton onClick={() => setReboteDialog({ open: false, row: null })}>
              <CloseIcon />
            </IconButton>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {reboteDialog.row?.email ?? ''}
          </Typography>

          <Box
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              p: 1.5,
              bgcolor: 'action.hover',
              borderRadius: 1,
            }}
          >
            {reboteDialog.row?.descripcion ?? '-'}
          </Box>
        </Box>
      </Modal>
    </Box>
  );
}