import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api' });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
            localStorage.removeItem('token');
            localStorage.removeItem('usuario');
            // Sin sesión no tienen que seguir llegando notificaciones de esta persona a este equipo. Import dinámico:
            // push.js usa este mismo cliente.
            await import('../pwa/push').then((m) => m.bajaPushSoloNavegador()).catch(() => undefined);
            // Después de entrar de nuevo, vuelve a la pantalla donde estaba.
            const volver = `${window.location.pathname}${window.location.search}`;
            window.location.href = `/login?volver=${encodeURIComponent(volver)}`;
        }
        return Promise.reject(error);
    },
);

export default api;
