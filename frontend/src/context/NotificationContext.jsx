import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { user, isLoggedIn } = useAuth();
    const myUserId = user?.sub;

    const [unreadCount, setUnreadCount] = useState(0);
    const [unassignedCount, setUnassignedCount] = useState(0);
    const [myActiveCount, setMyActiveCount] = useState(0);
    const [conversations, setConversations] = useState([]);
    const socketRef = useRef(null);

    const refreshCounts = useCallback(async () => {
        if (!isLoggedIn) return;
        try {
            const { data } = await api.get('/wapi/inbox');
            setConversations(data);
            
            let unread = 0;
            let unassigned = 0;
            let myActive = 0;

            data.forEach(c => {
                if (c.estado === 'sin_asignar') {
                    unassigned++;
                }
                if (c.asignadoAId === myUserId && c.estado !== 'resuelta') {
                    myActive++;
                    if (c.unreadCount > 0) unread++;
                }
            });

            setUnreadCount(unread);
            setUnassignedCount(unassigned);
            setMyActiveCount(myActive);
        } catch (error) {
            console.error('Error fetching notification counts:', error);
        }
    }, [isLoggedIn, myUserId]);

    useEffect(() => {
        if (isLoggedIn) {
            refreshCounts();

            const socket = io(import.meta.env.VITE_HOST_SOCKET);
            socketRef.current = socket;

            socket.on('connect', () => {
                socket.emit('join_inbox');
            });

            const handleUpdate = () => {
                // For simplicity, we refresh when anything happens. 
                // In a high-traffic app, we would update state incrementally.
                refreshCounts();
            };

            socket.on('wapi:nuevo_mensaje', handleUpdate);
            socket.on('wapi:conversacion_actualizada', handleUpdate);

            return () => {
                socket.disconnect();
            };
        } else {
            setUnreadCount(0);
            setUnassignedCount(0);
            setMyActiveCount(0);
            setConversations([]);
        }
    }, [isLoggedIn, refreshCounts]);

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
