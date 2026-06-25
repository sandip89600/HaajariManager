import { io, Socket } from "socket.io-client";
import { API_URL } from "@/utils/storage";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const socketUrl = API_URL.replace("/api", "");
    socket = io(socketUrl, {
      transports: ["websocket"],
      autoConnect: false, // Explicit connection managed via Auth context or SocketContext
    });
  }
  return socket;
};
