import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import RutaProtegida, { RequireAuth } from './components/RutaProtegida';
import BloqueEstado from './components/ui/BloqueEstado';
import { NotificationProvider } from './context/NotificationContext';
import { SocketProvider } from './context/SocketContext';

// Cada pantalla se baja cuando se abre (antes era un solo paquete de ~2,7 MB, con el editor de email y los gráficos
// incluidos también para las páginas públicas que ve el deudor).
const Login = lazy(() => import('./components/Login'));
const VistaPublicaEmail = lazy(() => import('./components/email/VistaPublicaEmail'));
const DesuscripcionConfirmar = lazy(() => import('./components/email/DesuscripcionConfirmar'));
const DesuscripcionResultado = lazy(() => import('./components/email/DesuscripcionResultado'));

const Inicio = lazy(() => import('./pages/Inicio'));
const MiPerfil = lazy(() => import('./pages/MiPerfil'));
const EstadoSesiones = lazy(() => import('./components/EstadoSesiones'));
const ConectarSesion = lazy(() => import('./components/ConectarSesion'));
const VerCampañas = lazy(() => import('./components/VerCampañas'));
const VerReportes = lazy(() => import('./components/VerReportes'));
const VerTemplates = lazy(() => import('./components/VerTemplates'));
const VerMetricas = lazy(() => import('./components/VerMetricas'));
const TareasProgramadas = lazy(() => import('./components/TareasProgramadas'));
const CuentasSMTP = lazy(() => import('./components/email/CuentasSMTP'));
const CrearTemplate = lazy(() => import('./components/email/CrearTemplate'));
const VerTemplatesEmail = lazy(() => import('./components/email/VerTemplatesEmail'));
const PreviewTemplate = lazy(() => import('./components/email/PreviewTemplate'));
const VerCampañasEmail = lazy(() => import('./components/email/VerCampañasEmail'));
const VerReportesEmail = lazy(() => import('./components/email/VerReportesEmail'));
const VerDesuscripcionesEmail = lazy(() => import('./components/email/VerDesuscripcionesEmail'));
const EnvioManual = lazy(() => import('./components/email/EnvioManual'));
const GestionUsuarios = lazy(() => import('./components/admin/GestionUsuarios'));
const GestionRoles = lazy(() => import('./components/admin/GestionRoles'));
const WapiConfig = lazy(() => import('./components/wapi/WapiConfig'));
const WapiTemplates = lazy(() => import('./components/wapi/WapiTemplates'));
const VerCampaniasWapi = lazy(() => import('./components/wapi/VerCampaniasWapi'));
const WapiInbox = lazy(() => import('./components/wapi/WapiInbox'));
const WapiBajas = lazy(() => import('./components/wapi/WapiBajas'));
const WapiAnalitica = lazy(() => import('./components/wapi/analitica/WapiAnalitica'));
const WapiLiveDashboard = lazy(() => import('./components/wapi/WapiLiveDashboard'));
const WapiRespuestasRapidas = lazy(() => import('./components/wapi/WapiRespuestasRapidas'));
const ListadoDeudores = lazy(() => import('./components/deudores/ListadoDeudores'));
const FichaDeudor = lazy(() => import('./components/deudores/FichaDeudor'));
const ReportesDeudores = lazy(() => import('./components/deudores/ReportesDeudores'));
const DevSimulador = lazy(() => import('./components/dev/DevSimulador'));

const cargando = <BloqueEstado estado="cargando" />;

/** Una pantalla privada: con permiso (si pide) y con su carga diferida. */
function P({ permiso, children }) {
    return (
        <RutaProtegida permiso={permiso}>
            <Suspense fallback={cargando}>{children}</Suspense>
        </RutaProtegida>
    );
}

export default function App() {
    return (
        <Routes>
            {/* Públicas */}
            <Route path="/login" element={<Suspense fallback={null}><Login /></Suspense>} />
            <Route path="/mailing/vista/:id" element={<Suspense fallback={null}><VistaPublicaEmail /></Suspense>} />
            <Route path="/mailing/desuscribirse" element={<Suspense fallback={null}><DesuscripcionConfirmar /></Suspense>} />
            <Route path="/mailing/desuscribirse/resultado" element={<Suspense fallback={null}><DesuscripcionResultado /></Suspense>} />

            {/* Privadas, dentro del marco */}
            <Route
                element={
                    <RequireAuth>
                        <SocketProvider>
                            <NotificationProvider>
                                <AppShell />
                            </NotificationProvider>
                        </SocketProvider>
                    </RequireAuth>
                }
            >
                <Route path="/" element={<P><Inicio /></P>} />
                <Route path="/perfil" element={<P><MiPerfil /></P>} />

                {/* Conversaciones */}
                <Route path="/wapi/inbox" element={<P permiso="wapi.inbox"><WapiInbox /></P>} />

                {/* Deudores */}
                <Route path="/deudores" element={<P permiso="deudores.ver"><ListadoDeudores /></P>} />
                <Route path="/deudores/reportes" element={<P permiso="deudores.reportes"><ReportesDeudores /></P>} />
                <Route path="/deudores/:id" element={<P permiso="deudores.ver"><FichaDeudor /></P>} />

                {/* WhatsApp API */}
                <Route path="/wapi/campanias" element={<P permiso="wapi.campanias"><VerCampaniasWapi /></P>} />
                <Route path="/wapi/live" element={<P permiso="wapi.campanias"><WapiLiveDashboard /></P>} />
                <Route path="/wapi/templates" element={<P permiso="wapi.templates"><WapiTemplates /></P>} />
                <Route path="/wapi/analitica" element={<P permiso="wapi.analitica"><WapiAnalitica /></P>} />
                <Route path="/wapi/bajas" element={<P permiso="wapi.bajas"><WapiBajas /></P>} />

                {/* Email */}
                <Route path="/email/campanias" element={<P permiso="email.campanias"><VerCampañasEmail /></P>} />
                <Route path="/email/envio-manual" element={<P permiso="email.envio_manual"><EnvioManual /></P>} />
                <Route path="/email/templates" element={<P permiso="email.templates"><VerTemplatesEmail /></P>} />
                <Route path="/email/crearTemplate" element={<P permiso="email.templates"><CrearTemplate /></P>} />
                <Route path="/preview-template/:id" element={<P permiso="email.templates"><PreviewTemplate /></P>} />
                <Route path="/email/reportes" element={<P permiso="email.reportes"><VerReportesEmail /></P>} />
                <Route path="/email/desuscripciones" element={<P permiso="email.desuscripciones"><VerDesuscripcionesEmail /></P>} />

                {/* WhatsApp Web */}
                <Route path="/sesiones" element={<P permiso="whatsapp.sesiones"><EstadoSesiones /></P>} />
                <Route path="/conectar" element={<P permiso="whatsapp.conectar"><ConectarSesion /></P>} />
                <Route path="/campanias" element={<P permiso="whatsapp.campanias"><VerCampañas /></P>} />
                <Route path="/templates" element={<P permiso="whatsapp.templates"><VerTemplates /></P>} />
                <Route path="/reportes" element={<P permiso="whatsapp.reportes"><VerReportes /></P>} />
                <Route path="/metricas" element={<P permiso="whatsapp.metricas"><VerMetricas /></P>} />
                {/* Rutas viejas que quedaban en blanco o fallaban: el flujo vive en Campañas. */}
                <Route path="/enviar" element={<Navigate to="/campanias" replace />} />
                <Route path="/subir-campania" element={<Navigate to="/campanias" replace />} />

                {/* Ajustes y Administración */}
                <Route path="/wapi/config" element={<P permiso="wapi.config"><WapiConfig /></P>} />
                <Route path="/email/cuentas" element={<P permiso="email.cuentas_smtp"><CuentasSMTP /></P>} />
                <Route path="/config/respuestas-rapidas" element={<P permiso="wapi.respuestas_rapidas"><WapiRespuestasRapidas /></P>} />
                <Route path="/config/tareas-programadas" element={<P permiso="config.tareas_programadas"><TareasProgramadas /></P>} />
                <Route path="/admin/usuarios" element={<P permiso="admin.usuarios"><GestionUsuarios /></P>} />
                <Route path="/admin/roles" element={<P permiso="admin.usuarios"><GestionRoles /></P>} />

                {import.meta.env.DEV && <Route path="/dev/simulador" element={<P><DevSimulador /></P>} />}
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
