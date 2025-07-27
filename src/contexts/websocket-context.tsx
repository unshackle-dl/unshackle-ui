import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useDownloadsStore } from '@/stores/downloads-store';
import { useServicesStore } from '@/stores/services-store';
import { type WebSocketMessage } from '@/lib/types';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

interface WebSocketContextType {
  isConnected: boolean;
  connectionState: ConnectionState;
  lastConnected: Date | null;
  reconnectAttempts: number;
  sendMessage: (message: any) => void;
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  url?: string;
}

export function WebSocketProvider({ 
  children, 
  url = 'ws://localhost:8888/ws' 
}: WebSocketProviderProps) {
  const { handleJobUpdate, handleJobProgress } = useDownloadsStore();
  const { updateServiceStatus } = useServicesStore();
  
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastConnected, setLastConnected] = useState<Date | null>(null);
  const [currentReconnectAttempts, setCurrentReconnectAttempts] = useState(0);
  const [autoConnect, setAutoConnect] = useState(true);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    try {
      switch (message.type) {
        case 'job_update':
          const jobUpdate = message.data;
          if (jobUpdate && jobUpdate.id) {
            handleJobUpdate(jobUpdate);
          }
          break;
          
        case 'job_progress':
          const progressUpdate = message.data;
          if (progressUpdate && progressUpdate.id && progressUpdate.progress !== undefined) {
            handleJobProgress(
              progressUpdate.id,
              progressUpdate.progress,
              progressUpdate.current_file
            );
          }
          break;
          
        case 'service_status':
          const serviceUpdate = message.data;
          if (serviceUpdate && serviceUpdate.id) {
            updateServiceStatus(serviceUpdate.id, serviceUpdate.status);
          }
          break;

        case 'ping':
          // Respond to server ping with pong - need to handle this via ref
          console.debug('Received ping from server');
          break;

        case 'pong':
          // Server responded to our ping
          console.debug('Received pong from server');
          break;

        case 'system_notification':
          // Handle system-wide notifications
          if (message.data) {
            console.log('System notification:', message.data);
            // Could trigger toast notifications or other UI updates
          }
          break;

        case 'queue_update':
          // Handle queue-level updates (like queue paused/resumed)
          if (message.data) {
            console.log('Queue update:', message.data);
            // Could update queue state or trigger UI updates
          }
          break;
          
        default:
          console.log('Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }, [handleJobUpdate, handleJobProgress, updateServiceStatus]);
  
  const handleOpen = useCallback(() => {
    console.log('WebSocket connection established');
    setConnectionState('connected');
    setLastConnected(new Date());
    setCurrentReconnectAttempts(0);
  }, []);
  
  const handleClose = useCallback(() => {
    console.log('WebSocket connection closed');
    setConnectionState('disconnected');
  }, []);
  
  const handleError = useCallback((error: Event) => {
    console.error('WebSocket connection error:', error);
    setConnectionState('error');
  }, []);
  
  const handleReconnecting = useCallback((attempt: number) => {
    console.log(`WebSocket reconnecting... attempt ${attempt}`);
    setConnectionState('reconnecting');
    setCurrentReconnectAttempts(attempt);
  }, []);

  const { sendMessage, isConnected, connect, disconnect } = useWebSocket({
    url,
    onMessage: handleMessage,
    onOpen: handleOpen,
    onClose: handleClose,
    onError: handleError,
    onReconnecting: handleReconnecting,
    reconnectAttempts: 10,
    reconnectInterval: 2000,
    autoConnect,
  });

  // Auto-connect when component mounts
  useEffect(() => {
    if (autoConnect) {
      setConnectionState('connecting');
      connect();
    }
  }, [autoConnect, connect]);

  // Health check - ping every 30 seconds when connected
  useEffect(() => {
    if (!isConnected) return;

    const healthCheck = setInterval(() => {
      try {
        sendMessage({ type: 'ping', timestamp: Date.now() });
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 30000);

    return () => clearInterval(healthCheck);
  }, [isConnected, sendMessage]);
  
  const contextValue = {
    isConnected,
    connectionState,
    lastConnected,
    reconnectAttempts: currentReconnectAttempts,
    sendMessage,
    connect: () => {
      setAutoConnect(true);
      setConnectionState('connecting');
      connect();
    },
    disconnect: () => {
      setAutoConnect(false);
      setConnectionState('disconnected');
      disconnect();
    },
  };
  
  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}