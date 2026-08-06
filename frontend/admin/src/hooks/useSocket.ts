import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      return;
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  return socket;
};
