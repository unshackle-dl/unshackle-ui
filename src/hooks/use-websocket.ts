import { useEffect, useRef, useCallback } from 'react';
import type { WebSocketMessage } from '@/lib/types';

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onAuthError?: () => void; // New: handle 4001 auth errors
  onJobNotFound?: () => void; // New: handle 4004 job not found errors
  onReconnecting?: (attempt: number) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  autoConnect?: boolean;
  enableHeartbeat?: boolean; // New: enable ping/pong heartbeat
  heartbeatInterval?: number; // New: heartbeat interval in ms
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  onAuthError,
  onJobNotFound,
  onReconnecting,
  reconnectAttempts = 5,
  reconnectInterval = 1000,
  autoConnect = true,
  enableHeartbeat = true,
  heartbeatInterval = 30000, // 30 seconds default
}: UseWebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPongRef = useRef<number>(Date.now());
  
  const startHeartbeat = useCallback((): void => {
    if (!enableHeartbeat) return;
    
    const sendPing = () => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        try {
          ws.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
          console.log('WebSocket: Sent ping');
          
          // Set timeout for pong response
          pingTimeoutRef.current = setTimeout(() => {
            const timeSinceLastPong = Date.now() - lastPongRef.current;
            if (timeSinceLastPong > heartbeatInterval * 2) {
              console.warn('WebSocket: No pong received, connection may be stale');
              // Trigger reconnection
              if (ws.current) {
                ws.current.close(1000, 'Heartbeat timeout');
              }
            }
          }, 10000); // Wait 10 seconds for pong
        } catch (error) {
          console.error('WebSocket: Failed to send ping:', error);
        }
      }
    };
    
    heartbeatTimeoutRef.current = setInterval(sendPing, heartbeatInterval);
  }, [enableHeartbeat, heartbeatInterval]);
  
  const stopHeartbeat = useCallback((): void => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
    if (pingTimeoutRef.current) {
      clearTimeout(pingTimeoutRef.current);
      pingTimeoutRef.current = null;
    }
  }, []);
  
  const connect = useCallback((): void => {
    try {
      ws.current = new WebSocket(url);
      
      ws.current.onopen = () => {
        console.log('WebSocket connected');
        reconnectCount.current = 0;
        lastPongRef.current = Date.now();
        startHeartbeat();
        onOpen?.();
      };
      
      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // Handle heartbeat messages
          if (message.type === 'pong' || message.event_type === 'pong') {
            lastPongRef.current = Date.now();
            console.log('WebSocket: Received pong');
            
            // Clear ping timeout since we got a response
            if (pingTimeoutRef.current) {
              clearTimeout(pingTimeoutRef.current);
              pingTimeoutRef.current = null;
            }
            return; // Don't pass pong messages to the application
          }
          
          if (message.type === 'ping' || message.event_type === 'ping') {
            // Respond to server ping with pong
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              console.log('WebSocket: Sent pong in response to ping');
            }
            return; // Don't pass ping messages to the application
          }
          
          onMessage?.(message);
        } catch (error) {
          console.error('WebSocket: Failed to parse message:', error, 'Raw data:', event.data);
        }
      };
      
      ws.current.onclose = (event) => {
        console.log(`WebSocket disconnected with code: ${event.code}, reason: ${event.reason}`);
        stopHeartbeat();
        onClose?.();
        
        // Handle specific API close codes
        if (event.code === 4001) {
          // Authentication error - don't retry automatically
          console.error('WebSocket: Authentication failed (4001) - Invalid token or unauthorized access');
          onAuthError?.();
          return;
        }
        
        if (event.code === 4004) {
          // Job not found - don't retry
          console.error('WebSocket: Job not found (4004) - The requested job ID does not exist');
          onJobNotFound?.();
          return;
        }
        
        // Enhanced logging for other close codes
        if (event.code === 1000) {
          console.log('WebSocket: Normal closure');
        } else if (event.code === 1001) {
          console.log('WebSocket: Going away');
        } else if (event.code === 1006) {
          console.warn('WebSocket: Abnormal closure (network issue)');
        } else if (event.code >= 4000) {
          console.error(`WebSocket: API-specific error (${event.code}): ${event.reason || 'Unknown error'}`);
        }
        
        // Attempt reconnection for other errors
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
  }, [url, onMessage, onOpen, onClose, onError, onAuthError, onJobNotFound, onReconnecting, reconnectAttempts, reconnectInterval, startHeartbeat, stopHeartbeat]);
  
  const disconnect = useCallback((): void => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    stopHeartbeat();
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    reconnectCount.current = 0;
  }, [stopHeartbeat]);
  
  const sendMessage = useCallback((message: Record<string, unknown>): void => {
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
    connectionState: ws.current?.readyState,
    reconnectAttempts: reconnectCount.current,
    lastPong: lastPongRef.current,
    isHeartbeatEnabled: enableHeartbeat,
  };
}