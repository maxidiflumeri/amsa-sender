import { Lock } from 'lucide-react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import EmptyState from './ui/EmptyState';

/** Sin sesión (o con el token vencido) manda al login, y después del login vuelve acá. */
export function RequireAuth({ children }) {
    const { autenticado } = useAuth();
    const location = useLocation();
    if (!autenticado) {
        const volver = `${location.pathname}${location.search}`;
        return <Navigate to={volver === '/' ? '/login' : `/login?volver=${encodeURIComponent(volver)}`} replace />;
    }
    return children;
}

/** Una pantalla que pide un permiso. Sin el permiso, lo dice y ofrece volver al inicio. */
export default function RutaProtegida({ permiso, children }) {
    const { hasPermiso } = useAuth();
    const navigate = useNavigate();
    const permisos = Array.isArray(permiso) ? permiso : permiso ? [permiso] : [];

    if (permisos.length > 0 && !permisos.some((p) => hasPermiso(p))) {
        return (
            <EmptyState
                icon={Lock}
                title="No tenés acceso a esta pantalla"
                description="Tu rol no tiene el permiso que hace falta. Si lo necesitás, pedíselo a quien administra los usuarios."
                action={{ label: 'Ir al inicio', onClick: () => navigate('/') }}
            />
        );
    }

    return children;
}
