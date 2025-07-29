import { useEffect, useCallback } from 'react';
import { useDownloadsStore } from '@/stores/downloads-store';
import { apiClientManager } from '@/lib/api/api-client-manager';
import { useWebSocketContext } from '@/contexts/websocket-context';
import { usePollingFallback } from './use-polling-fallback';

interface UseDownloadWebSocketReturn {
  isConnected: boolean;
  isPolling: boolean;
  pollingInterval: number;
  lastPollingSuccess: Date | null;
  pollingReason: string | null;
  isPollingForAuthFailure: boolean;
  isPollingForDisconnection: boolean;
  connectionState: string;
}

export function useDownloadWebSocket(): UseDownloadWebSocketReturn {
  const { updateStats, setJobs } = useDownloadsStore();
  const { isConnected } = useWebSocketContext();

  // Initialize enhanced polling fallback with auth failure support
  const pollingFallback = usePollingFallback({
    interval: 3000, // Poll every 3 seconds when disconnected
    maxInterval: 15000, // Max 15 seconds between polls
    onlyWhenDisconnected: true,
    activateOnAuthFailure: true, // Enable polling when WebSocket auth fails
  });

  // Load initial data
  const loadInitialData = useCallback(async (): Promise<void> => {
    try {
      const client = apiClientManager.getUnshackleClient();
      const jobs = await client.getAllJobs();
      setJobs(jobs);
      updateStats();
    } catch (error) {
      console.error('Failed to load initial jobs data:', error);
    }
  }, [setJobs, updateStats]);

  // Load initial data and setup polling fallback (WebSocket handling moved to WebSocketContext)
  useEffect(() => {
    // Load initial data on mount
    loadInitialData();
  }, [loadInitialData]);

  return {
    isConnected,
    isPolling: pollingFallback.isPolling,
    pollingInterval: pollingFallback.currentInterval,
    lastPollingSuccess: pollingFallback.lastSuccess,
    // Enhanced polling status information
    pollingReason: pollingFallback.pollingReason,
    isPollingForAuthFailure: pollingFallback.isActiveForAuthFailure,
    isPollingForDisconnection: pollingFallback.isActiveForDisconnection,
    connectionState: pollingFallback.connectionState,
  };
}