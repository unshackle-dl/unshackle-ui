import { createContext, useContext, useCallback, useEffect, useState, useRef } from 'react';
import { useDownloadsStore } from '@/stores/downloads-store';
import { useServicesStore } from '@/stores/services-store';
import { unshackleClient } from '@/lib/api';
import { useWebSocket } from '@/hooks/use-websocket';
import { getJobWebSocketURL, getGlobalWebSocketURL } from '@/lib/utils';
import { type WebSocketMessage, type ConnectionConfirmedEventData, isConnectionConfirmedEvent } from '@/lib/types';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error' | 'auth_failed' | 'job_not_found';

interface ConnectionMetadata {
  lastConnected: Date | null;
  lastDisconnected: Date | null;
  lastError: string | null;
  lastErrorTime: Date | null;
  connectionDuration: number; // in milliseconds
  totalReconnectAttempts: number;
  currentJobId: string | null;
  connectionType: 'global' | 'job' | null;
  lastPong: Date | null;
  isHeartbeatActive: boolean;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
}

interface WebSocketContextType {
  isConnected: boolean;
  connectionState: ConnectionState;
  connectionMetadata: ConnectionMetadata;
  reconnectAttempts: number;
  lastError: string | null;
  sendMessage: (message: any) => void;
  connect: () => void;
  disconnect: () => void;
  connectToJob: (jobId: string) => void;
  connectToGlobal: () => void;
  getConnectionStats: () => ConnectionMetadata;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ 
  children
}: WebSocketProviderProps) {
  const { handleJobUpdate, handleJobProgress } = useDownloadsStore();
  const { updateServiceStatus } = useServicesStore();
  
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [currentReconnectAttempts, setCurrentReconnectAttempts] = useState(0);
  const [autoConnect, setAutoConnect] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [currentWebSocketURL, setCurrentWebSocketURL] = useState<string | null>(null);
  
  // Enhanced metadata tracking
  const [connectionMetadata, setConnectionMetadata] = useState<ConnectionMetadata>({
    lastConnected: null,
    lastDisconnected: null,
    lastError: null,
    lastErrorTime: null,
    connectionDuration: 0,
    totalReconnectAttempts: 0,
    currentJobId: null,
    connectionType: null,
    lastPong: null,
    isHeartbeatActive: false,
    connectionQuality: 'unknown',
  });

  // Utility functions for metadata management
  const updateConnectionMetadata = useCallback((updates: Partial<ConnectionMetadata>) => {
    setConnectionMetadata(prev => ({ ...prev, ...updates }));
  }, []);

  const calculateConnectionQuality = useCallback((lastPong: Date | null, reconnectAttempts: number): ConnectionMetadata['connectionQuality'] => {
    if (!lastPong) return 'unknown';
    
    const timeSinceLastPong = Date.now() - lastPong.getTime();
    const reconnectPenalty = Math.min(reconnectAttempts * 0.2, 1); // Max 1 point penalty
    
    if (timeSinceLastPong < 30000 && reconnectAttempts === 0) {
      return 'excellent';
    } else if (timeSinceLastPong < 60000 && reconnectAttempts < 3) {
      return 'good';
    } else {
      return 'poor';
    }
  }, []);

  const updateConnectionDuration = useCallback(() => {
    setConnectionMetadata(prev => {
      if (prev.lastConnected && isConnected) {
        const duration = Date.now() - prev.lastConnected.getTime();
        return { ...prev, connectionDuration: duration };
      }
      return prev;
    });
  }, [isConnected]);

  // Update connection duration every 30 seconds when connected
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(updateConnectionDuration, 30000);
    return () => clearInterval(interval);
  }, [isConnected, updateConnectionDuration]);

  // Connect WebSocket when URL changes
  useEffect(() => {
    if (currentWebSocketURL && currentWebSocketURL.trim() !== '') {
      console.log('WebSocket URL changed, connecting to:', currentWebSocketURL);
      webSocketHook.connect();
    }
  }, [currentWebSocketURL, webSocketHook]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    try {
      // Parse API message format: {event_type, job_id, data, timestamp}
      const eventType = message.event_type || message.type; // Prioritize event_type from API
      const jobId = message.job_id; // Extract job_id directly from message
      const eventData = message.data;
      const timestamp = message.timestamp; // Handle timestamp for event ordering
      
      // Log received event for debugging
      console.debug(`WebSocket event: ${eventType}`, { jobId, timestamp, data: eventData });
      
      switch (eventType) {
        // API job status events (maps to handleJobUpdate store action)
        case 'job_status':
        case 'job_update': // Legacy compatibility
        case 'initial_status': // Initial job status sent upon connection
          if (eventData && (eventData.job_id || jobId)) {
            const jobUpdateId = jobId || eventData.job_id || eventData.id;
            
            // Transform API JobStatusEventData to DownloadJob format for store compatibility
            const normalizedJobUpdate = {
              ...eventData,
              id: jobUpdateId,
              job_id: jobUpdateId,
              // Map API fields to DownloadJob interface
              current_file: eventData.current_file,
              total_files: eventData.files_total,
              start_time: eventData.started_at,
              end_time: eventData.completed_at,
              timestamp: timestamp
            };
            
            // Map to downloads store handleJobUpdate action - preserves existing store interface
            handleJobUpdate(normalizedJobUpdate);
            console.log('Processed job status update', { 
              jobId: jobUpdateId, 
              status: eventData.status,
              progress: eventData.progress,
              isInitialStatus: timestamp && (Date.now() - timestamp * 1000) < 5000 // Within 5 seconds
            });
          } else {
            console.warn('job_status event missing job_id', { eventType, jobId, eventData });
          }
          break;
          
        // API connection confirmation events (sent immediately upon job WebSocket connection)
        case 'connection_confirmed':
          if (isConnectionConfirmedEvent(message)) {
            const confirmedJobId = jobId || message.data.job_id;
            console.log(`WebSocket connection confirmed for job ${confirmedJobId}`, { 
              timestamp,
              initialStatus: message.data.status,
              message: message.data.message
            });
            
            // If the connection confirmation includes job status, process it immediately
            if (message.data.status) {
              const initialJobStatus = {
                id: confirmedJobId,
                job_id: confirmedJobId,
                status: message.data.status,
                progress: message.data.progress,
                current_file: message.data.current_file,
                total_files: message.data.files_total || message.data.total_files,
                timestamp: timestamp
              };
              handleJobUpdate(initialJobStatus);
              console.log('Processed initial job status from connection confirmation', {
                jobId: confirmedJobId,
                status: message.data.status
              });
            }
          } else {
            console.warn('connection_confirmed event missing job_id', { eventType, jobId, eventData });
          }
          break;
          
        // API job progress events (maps to handleJobProgress store action)  
        case 'job_progress':
          if (eventData && eventData.progress !== undefined && (eventData.job_id || jobId)) {
            const progressJobId = jobId || eventData.job_id || eventData.id;
            
            // Map to downloads store handleJobProgress action - preserves existing store interface
            handleJobProgress(
              progressJobId,
              eventData.progress,
              eventData.current_file
            );
            
            // If the API provides additional progress data, update the job with it
            if (eventData.files_completed || eventData.files_total || eventData.downloaded_bytes || eventData.total_bytes) {
              const progressJobUpdate = {
                id: progressJobId,
                progress: eventData.progress,
                current_file: eventData.current_file,
                total_files: eventData.files_total,
                downloaded_bytes: eventData.downloaded_bytes,
                total_bytes: eventData.total_bytes
              };
              handleJobUpdate(progressJobUpdate);
            }
            
            console.debug('Mapped job_progress event to handleJobProgress', { 
              jobId: progressJobId, 
              progress: eventData.progress,
              currentFile: eventData.current_file
            });
          } else {
            console.warn('job_progress event missing required fields', { eventType, jobId, eventData });
          }
          break;
          
        // API service status events (maps to updateServiceStatus store action)
        case 'service_status':
          if (eventData && (eventData.service_id || eventData.id)) {
            const serviceId = eventData.service_id || eventData.id;
            // Map to services store updateServiceStatus action
            updateServiceStatus(serviceId, eventData.status);
            console.debug('Mapped service_status event to updateServiceStatus', { 
              serviceId, 
              status: eventData.status 
            });
          } else {
            console.warn('service_status event missing service_id', { eventType, eventData });
          }
          break;

        case 'ping':
          console.debug('Received ping from server');
          break;

        case 'pong':
          console.debug('Received pong from server');
          const now = new Date();
          updateConnectionMetadata({ 
            lastPong: now,
            connectionQuality: calculateConnectionQuality(now, currentReconnectAttempts)
          });
          break;

        // API system notification events (could map to notification store if implemented)
        case 'system_notification':
          if (eventData) {
            console.log('System notification:', eventData);
            // TODO: Map to notification store when implemented
            // notificationStore.addNotification(eventData);
          }
          break;

        // API queue update events (maps to downloads store queue state)
        case 'queue_update':
          if (eventData) {
            console.log('Queue update:', eventData);
            // Map queue status changes to downloads store if needed
            if (eventData.status === 'paused') {
              // Could trigger downloads store pauseQueue action
              console.debug('Queue paused via WebSocket event');
            } else if (eventData.status === 'running') {
              // Could trigger downloads store resumeQueue action  
              console.debug('Queue resumed via WebSocket event');
            }
          }
          break;

        // API test events (for development/debugging)
        case 'test_event':
          console.debug('Received test event from API:', eventData);
          break;
          
        default:
          console.log('Unknown WebSocket message type:', eventType, { message });
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error, { message });
    }
  }, [handleJobUpdate, handleJobProgress, updateServiceStatus]);

  // Enhanced callback handlers for useWebSocket hook
  const handleWebSocketOpen = useCallback(() => {
    console.log('WebSocket connection opened successfully');
    const now = new Date();
    setIsConnected(true);
    setConnectionState('connected');
    setCurrentReconnectAttempts(0);
    updateConnectionMetadata({
      lastConnected: now,
      connectionDuration: 0,
      connectionQuality: 'good',
      lastPong: now, // Initialize as just connected
      isHeartbeatActive: true
    });
  }, [updateConnectionMetadata]);

  const handleWebSocketClose = useCallback(() => {
    console.log('WebSocket connection closed');
    const now = new Date();
    setIsConnected(false);
    if (connectionState !== 'auth_failed' && connectionState !== 'job_not_found') {
      setConnectionState('disconnected');
    }
    updateConnectionMetadata({
      lastDisconnected: now,
      isHeartbeatActive: false
    });
  }, [updateConnectionMetadata, connectionState]);

  const handleAuthError = useCallback(() => {
    console.error('WebSocket authentication failed');
    const now = new Date();
    setConnectionState('auth_failed');
    setIsConnected(false);
    setLastError('Authentication failed. Please check your API configuration.');
    updateConnectionMetadata({
      lastError: 'Authentication failed',
      lastErrorTime: now,
      lastDisconnected: now,
      connectionQuality: 'poor'
    });
  }, [updateConnectionMetadata]);

  const handleJobNotFoundError = useCallback(() => {
    console.error('WebSocket job not found');
    const now = new Date();
    setConnectionState('job_not_found');
    setIsConnected(false);
    setLastError('Job not found. The requested job may have been completed or removed.');
    updateConnectionMetadata({
      lastError: 'Job not found',
      lastErrorTime: now,
      lastDisconnected: now,
      connectionQuality: 'poor'
    });
  }, [updateConnectionMetadata]);

  const handleConnectionError = useCallback((error: Event) => {
    console.error('WebSocket connection error:', error);
    const now = new Date();
    setConnectionState('error');
    setIsConnected(false);
    setLastError('Connection error occurred');
    updateConnectionMetadata({
      lastError: 'Connection error',
      lastErrorTime: now,
      lastDisconnected: now,
      connectionQuality: 'poor'
    });
  }, [updateConnectionMetadata]);

  const handleReconnecting = useCallback((attempt: number) => {
    console.log(`WebSocket reconnecting (attempt ${attempt})`);
    setConnectionState('reconnecting');
    setCurrentReconnectAttempts(attempt);
    updateConnectionMetadata({
      totalReconnectAttempts: connectionMetadata.totalReconnectAttempts + 1
    });
  }, [updateConnectionMetadata, connectionMetadata.totalReconnectAttempts]);

  // Initialize useWebSocket hook with current URL
  const webSocketHook = useWebSocket({
    url: currentWebSocketURL || '',
    onMessage: handleMessage,
    onOpen: handleWebSocketOpen,
    onClose: handleWebSocketClose,
    onError: handleConnectionError,
    onAuthError: handleAuthError,
    onJobNotFound: handleJobNotFoundError,
    onReconnecting: handleReconnecting,
    autoConnect: false, // We'll control connection manually
    enableHeartbeat: true,
    heartbeatInterval: 30000
  });

  // Connection management functions
  const connectToGlobal = useCallback(() => {
    // Prevent multiple simultaneous connections
    if (connectionState === 'connecting' || connectionState === 'connected') {
      console.log('Already connecting or connected, skipping connectToGlobal');
      return;
    }

    console.log('Connecting to global WebSocket events...');
    setConnectionState('connecting');
    setLastError(null);
    setCurrentReconnectAttempts(0);
    updateConnectionMetadata({
      connectionType: 'global',
      currentJobId: null,
      isHeartbeatActive: true
    });
    
    try {
      const globalURL = getGlobalWebSocketURL(unshackleClient.baseURL);
      setCurrentWebSocketURL(globalURL);
      // The useWebSocket hook will handle the connection when URL changes
    } catch (error) {
      console.error('Failed to construct global WebSocket URL:', error);
      setConnectionState('error');
      setIsConnected(false);
      setLastError('Failed to establish WebSocket connection');
    }
  }, [updateConnectionMetadata, connectionState]);

  const connectToJob = useCallback((jobId: string) => {
    // Prevent multiple simultaneous connections
    if (connectionState === 'connecting' || connectionState === 'connected') {
      console.log(`Already connecting or connected, skipping connectToJob for ${jobId}`);
      return;
    }

    console.log(`Connecting to job ${jobId} WebSocket events...`);
    setConnectionState('connecting');
    setLastError(null);
    setCurrentReconnectAttempts(0);
    updateConnectionMetadata({
      connectionType: 'job',
      currentJobId: jobId,
      isHeartbeatActive: true
    });
    
    try {
      const jobURL = getJobWebSocketURL(unshackleClient.baseURL, jobId);
      setCurrentWebSocketURL(jobURL);
      // The useWebSocket hook will handle the connection when URL changes
    } catch (error) {
      console.error(`Failed to construct job ${jobId} WebSocket URL:`, error);
      setConnectionState('error');
      setIsConnected(false);
      setLastError(`Failed to connect to job ${jobId}`);
    }
  }, [updateConnectionMetadata, connectionState]);

  const connect = useCallback(() => {
    if (connectionState === 'connecting' || connectionState === 'connected') {
      console.log('Already connecting or connected, skipping connect');
      return;
    }
    connectToGlobal();
  }, [connectToGlobal, connectionState]);

  const disconnect = useCallback(() => {
    try {
      webSocketHook.disconnect();
      setCurrentWebSocketURL(null);
      const now = new Date();
      setIsConnected(false);
      setConnectionState('disconnected');
      updateConnectionMetadata({
        lastDisconnected: now,
        isHeartbeatActive: false
      });
    } catch (error) {
      console.error('Failed to disconnect WebSocket:', error);
    }
  }, [updateConnectionMetadata, webSocketHook]);

  const getConnectionStats = useCallback((): ConnectionMetadata => {
    return { ...connectionMetadata };
  }, [connectionMetadata]);

  const sendMessage = useCallback((message: any) => {
    // Use the consolidated WebSocket hook's sendMessage
    webSocketHook.sendMessage(message);
  }, [webSocketHook]);

  // Auto-connect when component mounts
  useEffect(() => {
    if (autoConnect && connectionState === 'disconnected') {
      console.log('Auto-connecting WebSocket on mount...');
      connect();
    }
  }, [autoConnect, connectionState, connect]);

  // Cleanup WebSocket connection when component unmounts
  useEffect(() => {
    return () => {
      console.log('WebSocketProvider unmounting, disconnecting WebSocket...');
      webSocketHook.disconnect();
    };
  }, [webSocketHook]);
  
  const contextValue = {
    isConnected,
    connectionState,
    connectionMetadata,
    reconnectAttempts: currentReconnectAttempts,
    lastError,
    sendMessage,
    connect: () => {
      setAutoConnect(true);
      connect();
    },
    disconnect: () => {
      setAutoConnect(false);
      disconnect();
    },
    connectToJob,
    connectToGlobal,
    getConnectionStats,
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