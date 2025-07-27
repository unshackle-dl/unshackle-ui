import { useEffect, useRef, useCallback } from 'react';
import { type WebSocketMessage } from '@/lib/types';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onReconnecting?: (attempt: number) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  autoConnect?: boolean;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  onReconnecting,
  reconnectAttempts = 5,
  reconnectInterval = 1000,
  autoConnect = true,
}: UseWebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(url);
      
      ws.current.onopen = () => {
        console.log('WebSocket connected');
        reconnectCount.current = 0;
        onOpen?.();
      };
      
      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        onClose?.();
        
        // Attempt reconnection
        if (reconnectCount.current < reconnectAttempts) {
          const delay = Math.pow(2, reconnectCount.current) * reconnectInterval;
          console.log(`Attempting to reconnect in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectCount.current++;
            onReconnecting?.(reconnectCount.current);
            connect();
          }, delay);
        } else {
          console.log('Max reconnection attempts reached');
        }
      };
      
      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [url, onMessage, onOpen, onClose, onError, onReconnecting, reconnectAttempts, reconnectInterval]);
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    reconnectCount.current = 0;
  }, []);
  
  const sendMessage = useCallback((message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);
  
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect, autoConnect]);
  
  return {
    sendMessage,
    connect,
    disconnect,
    isConnected: ws.current?.readyState === WebSocket.OPEN,
  };
}