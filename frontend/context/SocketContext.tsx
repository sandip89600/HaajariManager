import React, { createContext, useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { getSocket } from "../services/socket";

interface SocketContextType {
  socket: Socket;
  isConnected: boolean;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const socket = getSocket();

  useEffect(() => {
    const onConnect = () => {
      console.log("[SocketContext] Socket connected successfully");
      setIsConnected(true);
    };

    const onDisconnect = () => {
      console.log("[SocketContext] Socket disconnected");
      setIsConnected(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket]);

  const connectSocket = () => {
    if (!socket.connected) {
      console.log("[SocketContext] Socket connecting...");
      socket.connect();
    }
  };

  const disconnectSocket = () => {
    if (socket.connected) {
      console.log("[SocketContext] Socket disconnecting...");
      socket.disconnect();
    }
  };

  return (
    <SocketContext.Provider
      value={{ socket, isConnected, connectSocket, disconnectSocket }}
    >
      {children}
    </SocketContext.Provider>
  );
}
