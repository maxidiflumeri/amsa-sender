import { createContext, useContext, useMemo } from 'react';

function decodeJwt(token) {
    try {
        const payload = token.split('.')[1];
        return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
        return null;
    }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const token = localStorage.getItem('token');
    const payload = useMemo(() => (token ? decodeJwt(token) : null), [token]);
    const permisos = payload?.permisos ?? [];

    const value = useMemo(() => ({
        permisos,
        hasPermiso: (key) => permisos.includes(key),
        user: payload,
    }), [permisos, payload]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
