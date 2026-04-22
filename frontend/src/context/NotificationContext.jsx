import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const loggedIn = !!user;
    const myUserId = user?.sub;

    const [unreadCount, setUnreadCount] = useState(0);
    const [unassignedCount, setUnassignedCount] = useState(0);
    const [myActiveCount, setMyActiveCount] = useState(0);
    const [conversations, setConversations] = useState([]);
    const socketRef = useRef(null);

    const hasWapiInbox = user?.permisos?.includes('wapi.inbox') ?? false;

    const refreshCounts = useCallback(async () => {
        if (!loggedIn || !hasWapiInbox) return;
        try {
            const { data } = await api.get('/wapi/inbox');
            if (!Array.isArray(data)) return;
            setConversations(data);
            
            let unread = 0;
            let unassigned = 0;
            let myActive = 0;

            data.forEach(c => {
                if (c.estado === 'sin_asignar') {
                    unassigned++;
                }
                const isMine = c.asignadoAId && String(c.asignadoAId) === String(myUserId);
                if (isMine && c.estado !== 'resuelta') {
                    myActive++;
                    if ((c.unreadCount || 0) > 0) unread++;
                }
            });

            setUnreadCount(unread);
            setUnassignedCount(unassigned);
            setMyActiveCount(myActive);
        } catch (error) {
            console.error('Error fetching notification counts:', error);
        }
    }, [loggedIn, myUserId, hasWapiInbox]);

    useEffect(() => {
        if (loggedIn && hasWapiInbox) {
            refreshCounts();

            const socket = io(import.meta.env.VITE_HOST_SOCKET);
            socketRef.current = socket;

            socket.on('connect', () => {
                socket.emit('join_inbox');
            });

            const handleUpdate = () => {
                refreshCounts();
            };

            socket.on('wapi:nuevo_mensaje', handleUpdate);
            socket.on('wapi:conversacion_actualizada', handleUpdate);

            return () => {
                if (socketRef.current) {
                    socketRef.current.disconnect();
                }
            };
        } else {
            setUnreadCount(0);
            setUnassignedCount(0);
            setMyActiveCount(0);
            setConversations([]);
        }
    }, [loggedIn, hasWapiInbox, refreshCounts]);

    return (
        <NotificationContext.Provider value={{ 
            unreadCount, 
            unassignedCount, 
            myActiveCount, 
            conversations,
            refreshCounts 
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
