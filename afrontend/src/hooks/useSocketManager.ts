import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketBaseURL } from '../services/api/config';

// Global socket instance to ensure only ONE connection per user
let globalSocket: Socket | null = null;
let connectionCount = 0;

interface SocketManagerOptions {
    token: string;
    userId: string;
    userType: 'Delivery' | 'Customer' | 'Seller' | 'Admin';
    onConnect?: () => void;
    onDisconnect?: (reason: string) => void;
    onError?: (error: Error) => void;
}

/**
 * Singleton Socket Manager
 * Ensures only ONE socket connection exists per user, even across multiple tabs/components
 */
export const useSocketManager = (options: SocketManagerOptions) => {
    const { token, userId, userType, onConnect, onDisconnect, onError } = options;
    const instanceIdRef = useRef<number>(0);

    useEffect(() => {
        // Assign unique instance ID
        connectionCount++;
        instanceIdRef.current = connectionCount;
        const instanceId = instanceIdRef.current;

        console.log(`[Socket Manager #${instanceId}] Component mounted`);

        // If socket already exists and is connected, reuse it
        if (globalSocket && globalSocket.connected) {
            console.log(`[Socket Manager #${instanceId}] Reusing existing socket connection`);
            onConnect?.();
            return () => {
                console.log(`[Socket Manager #${instanceId}] Component unmounted (socket kept alive)`);
            };
        }

        // If socket exists but disconnected, disconnect and recreate
        if (globalSocket) {
            console.log(`[Socket Manager #${instanceId}] Disconnecting stale socket`);
            globalSocket.disconnect();
            globalSocket = null;
        }

        // Create new socket connection
        console.log(`[Socket Manager #${instanceId}] Creating new socket connection`);
        const socket = io(getSocketBaseURL(), {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            timeout: 20000,
        });

        globalSocket = socket;

        socket.on('connect', () => {
            console.log(`[Socket Manager #${instanceId}] ✅ Connected:`, socket.id);
            onConnect?.();
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Socket Manager #${instanceId}] ❌ Disconnected:`, reason);
            onDisconnect?.(reason);
        });

        socket.on('connect_error', (error) => {
            console.error(`[Socket Manager #${instanceId}] Connection error:`, error.message);
            onError?.(error);
        });

        // Cleanup: Only disconnect if this is the last instance
        return () => {
            console.log(`[Socket Manager #${instanceId}] Component unmounted`);

            // Small delay to allow other components to mount
            setTimeout(() => {
                // If no other components are using the socket, disconnect
                if (connectionCount === instanceId) {
                    console.log(`[Socket Manager #${instanceId}] Last instance, disconnecting socket`);
                    globalSocket?.disconnect();
                    globalSocket = null;
                } else {
                    console.log(`[Socket Manager #${instanceId}] Other instances active, keeping socket alive`);
                }
            }, 100);
        };
    }, [token, userId, userType]);

    return globalSocket;
};

/**
 * Get the current global socket instance
 */
export const getGlobalSocket = (): Socket | null => {
    return globalSocket;
};

/**
 * Force disconnect the global socket (useful for logout)
 */
export const disconnectGlobalSocket = () => {
    if (globalSocket) {
        console.log('[Socket Manager] Force disconnecting global socket');
        globalSocket.disconnect();
        globalSocket = null;
        connectionCount = 0;
    }
};
