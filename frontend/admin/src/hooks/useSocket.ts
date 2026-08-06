import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

export interface ActivityItem {
  id: string;
  message: string;
  timestamp: string;
  type: string;
  userId?: string;
  userName?: string;
  [key: string]: any;
}

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [dashboardUpdate, setDashboardUpdate] = useState<any>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const socketRef = useRef<Socket | null>(null);
  
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!token) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    socket.on('admin_dashboard_update', (data) => {
      setDashboardUpdate(data);
    });

    socket.on('admin_activity', (data: ActivityItem) => {
      setActivityFeed((prevFeed) => {
        const newFeed = [data, ...prevFeed];
        // Keep only the last 50 items
        return newFeed.slice(0, 50);
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  return {
    isConnected,
    dashboardUpdate,
    activityFeed,
    socket: socketRef.current,
  };
};
