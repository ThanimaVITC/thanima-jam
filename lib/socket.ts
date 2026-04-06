import { io, Socket } from "socket.io-client";

// Use the current origin for the socket connection (auto-detects port/hostname)
const URL = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

export const socket: Socket = io(URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ["websocket", "polling"],
});

// Log connection status
socket.on("connect", () => {
    console.log(`[SOCKET] Connected to server: ${socket.id}`);
});

socket.on("disconnect", (reason) => {
    console.log(`[SOCKET] Disconnected: ${reason}`);
});

socket.on("connect_error", (error) => {
    console.error(`[SOCKET] Connection Error:`, error.message);
});

socket.on("reconnect", (attemptNumber) => {
    console.log(`[SOCKET] Reconnected after ${attemptNumber} attempts`);
});

socket.on("reconnect_attempt", (attemptNumber) => {
    console.log(`[SOCKET] Attempting to reconnect: ${attemptNumber}`);
});

socket.on("reconnect_error", (error) => {
    console.error(`[SOCKET] Reconnection Error:`, error.message);
});

socket.on("reconnect_failed", () => {
    console.error(`[SOCKET] Reconnection failed`);
});
