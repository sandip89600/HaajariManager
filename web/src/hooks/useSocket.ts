import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export function useSocket(
  onActivity?: (activity: any) => void,
  onDashboardUpdate?: () => void
) {
  const { token } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    // Connect to Socket.IO server with fallback transports
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected to administrative events stream');
    });

    if (onActivity) {
      socket.on('admin_activity', (data) => {
        onActivity(data);
      });
    }

    if (onDashboardUpdate) {
      socket.on('admin_dashboard_update', () => {
        onDashboardUpdate();
      });
    }

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from administrative events stream');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, onActivity, onDashboardUpdate]);

  return socketRef.current;
}
