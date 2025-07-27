import { useEffect, useCallback } from 'react';
import { useDownloadsStore } from '@/stores/downloads-store';
import { useServicesStore } from '@/stores/services-store';
import { apiClientManager } from '@/lib/api/api-client-manager';
import { useWebSocketContext } from '@/contexts/websocket-context';
import { usePollingFallback } from './use-polling-fallback';
import type { WebSocketMessage, DownloadJob } from '@/lib/types';

export function useDownloadWebSocket() {
  const { handleJobUpdate, handleJobProgress, updateStats, setJobs } = useDownloadsStore();
  const { updateServiceStatus } = useServicesStore();
  const { isConnected } = useWebSocketContext();

  // Initialize polling fallback
  const pollingFallback = usePollingFallback({
    interval: 3000, // Poll every 3 seconds when disconnected
    maxInterval: 15000, // Max 15 seconds between polls
    onlyWhenDisconnected: true,
  });

  // Load initial data
  const loadInitialData = useCallback(async () => {
    try {
      const client = apiClientManager.getUnshackleClient();
      const jobs = await client.getAllJobs();
      setJobs(jobs);
      updateStats();
    } catch (error) {
      console.error('Failed to load initial jobs data:', error);
    }
  }, [setJobs, updateStats]);

  // Handle WebSocket messages (this now happens in the context)
  useEffect(() => {
    const client = apiClientManager.getUnshackleClient();
    
    // Only connect if we're going to handle the messages here
    // In practice, the context now handles this, but keeping for backward compatibility
    if (isConnected) {
      client.connectWebSocket((message: WebSocketMessage) => {
        try {
          switch (message.type) {
            case 'job_update':
              if (message.data && message.data.id) {
                handleJobUpdate(message.data as Partial<DownloadJob> & { id: string });
                updateStats();
              }
              break;
              
            case 'job_progress':
              if (message.data && message.data.id && message.data.progress !== undefined) {
                handleJobProgress(
                  message.data.id,
                  message.data.progress,
                  message.data.current_file
                );
                updateStats();
              }
              break;
              
            case 'service_status':
              if (message.data && message.data.id) {
                updateServiceStatus(message.data.id, message.data.status);
              }
              break;
              
            default:
              console.log('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Error handling WebSocket message in download hook:', error);
        }
      });
    }

    // Load initial data on mount
    loadInitialData();

    // Cleanup on unmount
    return () => {
      client.disconnectWebSocket();
    };
  }, [
    handleJobUpdate, 
    handleJobProgress, 
    updateStats, 
    updateServiceStatus, 
    isConnected,
    loadInitialData
  ]);

  return {
    isConnected,
    isPolling: pollingFallback.isPolling,
    pollingInterval: pollingFallback.currentInterval,
    lastPollingSuccess: pollingFallback.lastSuccess,
  };
}