import { useEffect, useRef, useCallback } from 'react';
import { useDownloadsStore } from '@/stores/downloads-store';
import { apiClientManager } from '@/lib/api/api-client-manager';
import { useWebSocketContext } from '@/contexts/websocket-context';

interface PollingConfig {
  enabled: boolean;
  interval: number;
  maxInterval: number;
  backoffMultiplier: number;
  onlyWhenDisconnected?: boolean;
}

const DEFAULT_CONFIG: PollingConfig = {
  enabled: true,
  interval: 5000, // 5 seconds
  maxInterval: 30000, // 30 seconds max
  backoffMultiplier: 1.5,
  onlyWhenDisconnected: true,
};

export function usePollingFallback(config: Partial<PollingConfig> = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { isConnected } = useWebSocketContext();
  const { setJobs, updateStats } = useDownloadsStore();
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIntervalRef = useRef(mergedConfig.interval);
  const lastSuccessRef = useRef<number>(Date.now());
  const isPollingRef = useRef(false);

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      isPollingRef.current = false;
    }
  }, []);

  const pollJobs = useCallback(async () => {
    try {
      const client = apiClientManager.getUnshackleClient();
      const jobs = await client.getAllJobs();
      
      setJobs(jobs);
      updateStats();
      lastSuccessRef.current = Date.now();
      
      // Reset interval on success
      currentIntervalRef.current = mergedConfig.interval;
      
      return true;
    } catch (error) {
      console.warn('Polling failed:', error);
      
      // Exponential backoff on failure
      currentIntervalRef.current = Math.min(
        currentIntervalRef.current * mergedConfig.backoffMultiplier,
        mergedConfig.maxInterval
      );
      
      return false;
    }
  }, [setJobs, updateStats, mergedConfig.interval, mergedConfig.backoffMultiplier, mergedConfig.maxInterval]);

  const startPolling = useCallback(() => {
    if (isPollingRef.current) return;
    
    isPollingRef.current = true;
    currentIntervalRef.current = mergedConfig.interval;
    
    console.log('Starting polling fallback with interval:', currentIntervalRef.current);
    
    // Initial poll
    pollJobs();
    
    const poll = () => {
      pollJobs().then(() => {
        if (isPollingRef.current) {
          intervalRef.current = setTimeout(poll, currentIntervalRef.current);
        }
      });
    };
    
    intervalRef.current = setTimeout(poll, currentIntervalRef.current);
  }, [pollJobs, mergedConfig.interval]);

  const stopPolling = useCallback(() => {
    console.log('Stopping polling fallback');
    clearPolling();
  }, [clearPolling]);

  // Manage polling based on WebSocket connection
  useEffect(() => {
    if (!mergedConfig.enabled) {
      clearPolling();
      return;
    }

    if (mergedConfig.onlyWhenDisconnected) {
      if (!isConnected) {
        startPolling();
      } else {
        stopPolling();
      }
    } else {
      // Always poll (less common use case)
      startPolling();
    }

    return () => clearPolling();
  }, [
    isConnected, 
    mergedConfig.enabled, 
    mergedConfig.onlyWhenDisconnected,
    startPolling,
    stopPolling,
    clearPolling
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearPolling();
  }, [clearPolling]);

  return {
    isPolling: isPollingRef.current,
    currentInterval: currentIntervalRef.current,
    lastSuccess: lastSuccessRef.current,
    startPolling,
    stopPolling,
  };
}