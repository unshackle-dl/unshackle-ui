import { createContext, useContext, useCallback } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useDownloadsStore } from '@/stores/downloads-store';
import { useServicesStore } from '@/stores/services-store';
import { type WebSocketMessage } from '@/lib/types';

interface WebSocketContextType {
  isConnected: boolean;
  sendMessage: (message: any) => void;
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
  const { updateJob } = useDownloadsStore();
  const { updateServiceStatus } = useServicesStore();
  
  const handleMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'job_update':
        // Update download job with progress or status change
        const jobUpdate = message.data;
        updateJob(jobUpdate.id, jobUpdate);
        break;
        
      case 'service_status':
        // Update service availability status
        const serviceUpdate = message.data;
        updateServiceStatus(serviceUpdate.id, serviceUpdate.status);
        break;
        
      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  }, [updateJob, updateServiceStatus]);
  
  const handleOpen = useCallback(() => {
    console.log('WebSocket connection established');
  }, []);
  
  const handleClose = useCallback(() => {
    console.log('WebSocket connection closed');
  }, []);
  
  const handleError = useCallback((error: Event) => {
    console.error('WebSocket connection error:', error);
  }, []);
  
  const { sendMessage, isConnected } = useWebSocket({
    url,
    onMessage: handleMessage,
    onOpen: handleOpen,
    onClose: handleClose,
    onError: handleError,
    reconnectAttempts: 5,
    reconnectInterval: 2000,
  });
  
  return (
    <WebSocketContext.Provider value={{ isConnected, sendMessage }}>
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