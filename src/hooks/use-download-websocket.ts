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
  };
}