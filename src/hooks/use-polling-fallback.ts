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
  activateOnAuthFailure?: boolean; // New: activate polling when WebSocket auth fails
}

const DEFAULT_CONFIG: PollingConfig = {
  enabled: true,
  interval: 5000, // 5 seconds
  maxInterval: 30000, // 30 seconds max
  backoffMultiplier: 1.5,
  onlyWhenDisconnected: true,
  activateOnAuthFailure: true, // Default: activate polling on auth failures
};

export function usePollingFallback(config: Partial<PollingConfig> = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { isConnected, connectionState } = useWebSocketContext();
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
      
      console.debug(`Polling successful: retrieved ${jobs.length} jobs`);
      return true;
    } catch (error) {
      console.warn('Polling failed:', error);
      
      // Check if this is an authentication error from the API
      if (error instanceof Error && (
        error.message.includes('401') || 
        error.message.includes('Unauthorized') ||
        error.message.includes('Authentication failed')
      )) {
        console.error('Polling failed due to authentication error - REST API also requires valid token');
        // Still continue polling as it may be a temporary issue
      }
      
      // Exponential backoff on failure
      const newInterval = Math.min(
        currentIntervalRef.current * mergedConfig.backoffMultiplier,
        mergedConfig.maxInterval
      );
      
      console.debug(`Polling backoff: increasing interval from ${currentIntervalRef.current}ms to ${newInterval}ms`);
      currentIntervalRef.current = newInterval;
      
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

  // Enhanced polling logic that considers WebSocket connection state and auth failures
  const shouldStartPolling = useCallback(() => {
    if (!mergedConfig.enabled) return false;
    
    // Start polling when disconnected (standard fallback)
    if (!isConnected) {
      console.log('Starting polling: WebSocket disconnected');
      return true;
    }
    
    // Start polling when authentication fails (enhanced fallback)
    if (mergedConfig.activateOnAuthFailure && connectionState === 'auth_failed') {
      console.log('Starting polling: WebSocket authentication failed');
      return true;
    }
    
    // Start polling when job not found (enhanced fallback)
    if (mergedConfig.activateOnAuthFailure && connectionState === 'job_not_found') {
      console.log('Starting polling: WebSocket job not found');
      return true;
    }
    
    // Always poll mode (less common)
    if (!mergedConfig.onlyWhenDisconnected) {
      return true;
    }
    
    return false;
  }, [isConnected, connectionState, mergedConfig.enabled, mergedConfig.onlyWhenDisconnected, mergedConfig.activateOnAuthFailure]);

  // Manage polling based on WebSocket connection state and auth status
  useEffect(() => {
    if (shouldStartPolling()) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => clearPolling();
  }, [
    shouldStartPolling,
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
    // Enhanced status information
    isActiveForAuthFailure: mergedConfig.activateOnAuthFailure && (connectionState === 'auth_failed' || connectionState === 'job_not_found'),
    isActiveForDisconnection: !isConnected,
    connectionState,
    pollingReason: shouldStartPolling() ? 
      (!isConnected ? 'disconnected' : 
       connectionState === 'auth_failed' ? 'auth_failed' : 
       connectionState === 'job_not_found' ? 'job_not_found' : 
       'always_enabled') : 
      'not_needed'
  };
}