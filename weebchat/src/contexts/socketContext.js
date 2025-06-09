import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';
import AuthContext from './AuthContext';
import { SOCKET_URL } from '../constants'; // Import SOCKET_URL constant

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;
    
    const { isAuthenticated, refreshToken } = useContext(AuthContext);

    const connectSocket = useCallback(() => {
        if (isAuthenticated && !isConnecting) {
            setIsConnecting(true);
            console.log("SocketContext: Attempting to connect socket as user is authenticated.");
            
            // Clear any previous error state
            setConnectionError(null);
            
            // FIX: Use the imported SOCKET_URL constant instead of hardcoded URL
            const newSocket = io(SOCKET_URL, {
                withCredentials: true, // IMPORTANT: Allows cookies (including JWT) to be sent with requests
                transports: ['polling', 'websocket'],
                reconnectionAttempts: 3,
                reconnectionDelay: 1000
            });

            newSocket.on('connect_error', (err) => {
                console.error("Socket connection error (connect_error):", err.message, err);
                setConnectionError({
                    type: 'connect_error',
                    message: err.message
                });
                
                // Handle specific auth errors from socketVerification.js middleware
                if (err.message.includes("Authentication error")) {
                    reconnectAttemptsRef.current += 1;
                    
                    if (reconnectAttemptsRef.current <= maxReconnectAttempts) {
                        console.log(`Reconnect attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
                        
                        // If we have a refresh function, attempt to refresh token and reconnect
                        if (refreshToken) {
                            refreshToken().then(() => {
                                console.log("Token refreshed, reconnecting socket...");
                                setTimeout(() => {
                                    if (newSocket) newSocket.disconnect();
                                    setIsConnecting(false);
                                    connectSocket();
                                }, 1000);
                            }).catch(err => {
                                console.error("Failed to refresh token:", err);
                                setIsConnecting(false);
                            });
                        } else {
                            // Simple retry without token refresh
                            setTimeout(() => {
                                if (newSocket) newSocket.disconnect();
                                setIsConnecting(false);
                                connectSocket();
                            }, 2000);
                        }
                    } else {
                        console.error("Max reconnect attempts reached");
                        setIsConnecting(false);
                    }
                }
            });

            newSocket.on('connect', () => {
                console.log('Socket connected:', newSocket.id);
                setIsConnecting(false);
                reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
            });

            newSocket.on('disconnect', (reason) => {
                console.log('Socket disconnected:', reason);
                
                // Handle different disconnect reasons differently
                if (reason === 'io server disconnect') {
                    // The server has forcefully disconnected us, e.g., due to invalid token
                    console.log('Server forcefully disconnected, not attempting automatic reconnect');
                    setConnectionError({
                        type: 'force_disconnect',
                        message: 'Disconnected by server. Please log in again.'
                    });
                    // You might want to trigger a logout here depending on your auth flow
                } else if (reason === 'transport close' || reason === 'ping timeout' || reason === 'io client disconnect') {
                    // These are potentially recoverable, or initiated by client, socket.io's auto-reconnect should handle it.
                    console.log('Transport issue or client disconnect. Socket will attempt to reconnect automatically.');
                }
            });
            
            newSocket.on('error', (error) => { // General errors after connection
                console.error('Socket error (general):', error);
                setConnectionError({
                    type: 'general_error',
                    message: typeof error === 'string' ? error : error.message || 'Unknown socket error'
                });
            });
            
            setSocket(newSocket);
            return newSocket; // Return for cleanup reference
        }
        
        if (!isAuthenticated) {
            console.log("SocketContext: Connection not attempted. User not authenticated.");
        }
        return null;
    }, [isAuthenticated, refreshToken, isConnecting]); // Added SOCKET_URL to dep array

    useEffect(() => {
        let currentSocketInstance = null;

        if (isAuthenticated) {
            if (!socket || !socket.connected) { // Connect if authenticated and not already connected
                console.log("SocketContext useEffect: User authenticated, attempting to connect or re-establish socket.");
                currentSocketInstance = connectSocket();
            } else {
                console.log("SocketContext useEffect: User authenticated, socket already exists and presumed connected.");
                // If the socket exists and is connected, ensure `isConnecting` is false
                if (isConnecting) setIsConnecting(false);
                currentSocketInstance = socket; // Use existing socket for cleanup reference
            }
        } else {
            // User is not authenticated
            if (socket) {
                console.log("SocketContext useEffect: User not authenticated, disconnecting existing socket.");
                socket.disconnect();
                setSocket(null); // Clear socket state
                setConnectionError(null); // Clear any error state
                reconnectAttemptsRef.current = 0; // Reset reconnect attempts
                setIsConnecting(false); // Ensure connecting state is false
            }
        }

        return () => {
            // Component unmount or dependencies change causing re-run
            if (currentSocketInstance && currentSocketInstance.connected) {
                console.log('SocketContext useEffect cleanup: Disconnecting socket instance', currentSocketInstance.id);
                currentSocketInstance.disconnect();
            }
        };
    }, [isAuthenticated, connectSocket, socket, isConnecting]);

    // Emit an event with retry capability
    const emitEvent = useCallback((eventName, data, options = {}) => {
        const { retryCount = 3, retryDelay = 1000, onSuccess, onError } = options;
        
        const attemptEmit = (attemptsLeft) => {
            if (!socket || !socket.connected) {
                console.warn(`Socket not connected. Cannot emit event: ${eventName}. Current socket state:`, socket);
                
                if (attemptsLeft > 0) {
                    console.log(`Will retry emitting ${eventName} in ${retryDelay}ms. Attempts left: ${attemptsLeft}`);
                    setTimeout(() => attemptEmit(attemptsLeft - 1), retryDelay);
                } else if (onError) {
                    onError(new Error(`Failed to emit ${eventName}: Socket not connected`));
                }
                return;
            }
            
            try {
                socket.emit(eventName, data);
                if (onSuccess) onSuccess();
            } catch (err) {
                console.error(`Error emitting ${eventName}:`, err);
                if (onError) onError(err);
            }
        };
        
        attemptEmit(retryCount);
    }, [socket]);
    
    const onEvent = useCallback((eventName, callback) => {
        if (socket) {
            socket.on(eventName, callback);
            // Return a cleanup function to remove the listener
            return () => {
                if (socket) { // Check socket again in case it's nullified before cleanup runs
                    socket.off(eventName, callback);
                }
            };
        } else {
            console.warn(`Socket not connected. Cannot register listener for: ${eventName}`);
            return () => {}; // No-op cleanup if socket is not available
        }
    }, [socket]);

    // Force reconnect function that can be called from components
    const reconnect = useCallback(() => {
        if (socket) {
            socket.disconnect(); // Disconnect existing socket cleanly
        }
        setSocket(null); // Clear socket state
        reconnectAttemptsRef.current = 0; // Reset attempts
        setIsConnecting(false); // Reset connecting state
        return connectSocket(); // Attempt to connect again
    }, [socket, connectSocket]);

    const contextValue = {
        socket,
        emitEvent,
        onEvent,
        connectSocket,
        reconnect,
        isConnecting,
        connectionError
    };

    return (
        <SocketContext.Provider value={contextValue}>
            {children}
        </SocketContext.Provider>
    );
};

export default SocketContext;