/**
 * React hook for managing downloads with the Unshackle API.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  unshackleApi, 
  unshackleWebSocket, 
  UnshackleApiError,
  DownloadRequest,
  DownloadResponse,
  DownloadJob,
  DownloadQueueResponse,
  ServiceMatch,
  TrackListingResponse,
  WebSocketMessage
} from '@/lib/services/unshackle-api';

export interface UseDownloadOptions {
  onError?: (error: UnshackleApiError) => void;
  onProgress?: (jobId: string, progress: number) => void;
  onComplete?: (jobId: string) => void;
}

export interface DownloadState {
  isLoading: boolean;
  error: string | null;
  activeJob: DownloadJob | null;
  queue: DownloadJob[];
  completed: DownloadJob[];
  isConnected: boolean;
}

/**
 * Hook for checking streaming service availability.
 */
export function useServiceAvailability() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAvailability = useCallback(async (urls: string[]): Promise<ServiceMatch[]> => {
    console.log('[useServiceAvailability] Starting availability check for URLs:', urls);
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useServiceAvailability] Calling API...');
      const response = await unshackleApi.checkAvailability(urls);
      console.log('[useServiceAvailability] API response received:', response);
      return response.matches;
    } catch (err) {
      console.error('[useServiceAvailability] API call failed:', err);
      const errorMessage = err instanceof UnshackleApiError ? err.message : 'Failed to check availability';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
      console.log('[useServiceAvailability] Finished availability check');
    }
  }, []);

  return {
    checkAvailability,
    isLoading,
    error,
  };
}

/**
 * Hook for listing available tracks.
 */
export function useTrackListing() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackListingResponse | null>(null);

  const listTracks = useCallback(async (service: string, url: string, options?: {
    type?: 'all' | 'season' | 'episode';
    season?: number;
    episode?: number;
    profile?: string;
    proxy?: string;
  }): Promise<TrackListingResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const request = {
        service,
        url,
        selection: options ? {
          type: options.type || 'all',
          season: options.season,
          episode: options.episode,
        } : undefined,
        profile: options?.profile,
        proxy: options?.proxy,
      };

      const response = await unshackleApi.listTracks(request);
      setTracks(response);
      return response;
    } catch (err) {
      const errorMessage = err instanceof UnshackleApiError ? err.message : 'Failed to list tracks';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearTracks = useCallback(() => {
    setTracks(null);
    setError(null);
  }, []);

  return {
    listTracks,
    clearTracks,
    tracks,
    isLoading,
    error,
  };
}

/**
 * Main download management hook.
 */
export function useDownload(options?: UseDownloadOptions) {
  const [state, setState] = useState<DownloadState>({
    isLoading: false,
    error: null,
    activeJob: null,
    queue: [],
    completed: [],
    isConnected: false,
  });

  const subscribedJobs = useRef<Set<string>>(new Set());

  // WebSocket connection and message handling
  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        await unshackleWebSocket.connect();
        setState(prev => ({ ...prev, isConnected: true, error: null }));
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        setState(prev => ({ 
          ...prev, 
          isConnected: false, 
          error: 'Failed to connect to download progress updates' 
        }));
      }
    };

    // Message handlers
    const handleProgress = (message: WebSocketMessage) => {
      if (message.job_id && message.data?.progress_percent !== undefined) {
        options?.onProgress?.(message.job_id, message.data.progress_percent);
      }
    };

    const handleJobStatus = (message: WebSocketMessage) => {
      if (message.job_id && message.status === 'completed') {
        options?.onComplete?.(message.job_id);
        // Refresh queue to update job status
        refreshQueue();
      }
    };

    const handleError = (message: WebSocketMessage) => {
      if (message.error_code && message.message) {
        const error = new UnshackleApiError(message.message, 0, message.error_code);
        options?.onError?.(error);
      }
    };

    // Add event listeners
    unshackleWebSocket.addEventListener('progress', handleProgress);
    unshackleWebSocket.addEventListener('job_status', handleJobStatus);
    unshackleWebSocket.addEventListener('error', handleError);

    connectWebSocket();

    return () => {
      // Clean up WebSocket listeners
      unshackleWebSocket.removeEventListener('progress', handleProgress);
      unshackleWebSocket.removeEventListener('job_status', handleJobStatus);
      unshackleWebSocket.removeEventListener('error', handleError);
    };
  }, []);

  // Refresh download queue (shared function)
  const refreshQueue = useCallback(async () => {
    try {
      const queueData = await unshackleApi.getDownloadQueue();
      setState(prev => ({
        ...prev,
        activeJob: queueData.active,
        queue: queueData.queued,
        completed: queueData.completed,
        error: null,
      }));

      // Subscribe to active job progress if not already subscribed
      if (queueData.active && !subscribedJobs.current.has(queueData.active.job_id)) {
        unshackleWebSocket.subscribeToJob(queueData.active.job_id);
        subscribedJobs.current.add(queueData.active.job_id);
      }

    } catch (err) {
      const errorMessage = err instanceof UnshackleApiError ? err.message : 'Failed to refresh queue';
      setState(prev => ({ ...prev, error: errorMessage }));
      options?.onError?.(err instanceof UnshackleApiError ? err : new UnshackleApiError(errorMessage));
    }
  }, [options]);

  // Auto-refresh queue every 5 seconds when connected and there's an active job
  useEffect(() => {
    if (!state.isConnected || (!state.activeJob && state.queue.length === 0)) {
      return;
    }

    const interval = setInterval(refreshQueue, 5000);
    return () => clearInterval(interval);
  }, [refreshQueue, state.isConnected, state.activeJob, state.queue.length]);

  // Initial queue load when WebSocket connects
  useEffect(() => {
    if (state.isConnected) {
      refreshQueue();
    }
  }, [refreshQueue, state.isConnected]);

  // Start a download
  const startDownload = useCallback(async (request: DownloadRequest): Promise<DownloadResponse> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await unshackleApi.startDownload(request);
      
      // Subscribe to job progress updates
      unshackleWebSocket.subscribeToJob(response.job_id);
      subscribedJobs.current.add(response.job_id);
      
      // Refresh queue to show the new job
      await refreshQueue();
      
      setState(prev => ({ ...prev, isLoading: false }));
      return response;
    } catch (err) {
      const errorMessage = err instanceof UnshackleApiError ? err.message : 'Failed to start download';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      
      const error = err instanceof UnshackleApiError ? err : new UnshackleApiError(errorMessage);
      options?.onError?.(error);
      throw error;
    }
  }, [refreshQueue, options]);

  // Cancel a download job
  const cancelJob = useCallback(async (jobId: string): Promise<void> => {
    try {
      await unshackleApi.cancelJob(jobId);
      
      // Unsubscribe from job updates
      unshackleWebSocket.unsubscribeFromJob(jobId);
      subscribedJobs.current.delete(jobId);
      
      // Refresh queue
      await refreshQueue();
    } catch (err) {
      const errorMessage = err instanceof UnshackleApiError ? err.message : 'Failed to cancel job';
      setState(prev => ({ ...prev, error: errorMessage }));
      
      const error = err instanceof UnshackleApiError ? err : new UnshackleApiError(errorMessage);
      options?.onError?.(error);
      throw error;
    }
  }, [refreshQueue, options]);

  // Clear completed jobs
  const clearCompleted = useCallback(async (): Promise<void> => {
    try {
      await unshackleApi.clearCompletedJobs();
      await refreshQueue();
    } catch (err) {
      const errorMessage = err instanceof UnshackleApiError ? err.message : 'Failed to clear completed jobs';
      setState(prev => ({ ...prev, error: errorMessage }));
      
      const error = err instanceof UnshackleApiError ? err : new UnshackleApiError(errorMessage);
      options?.onError?.(error);
      throw error;
    }
  }, [refreshQueue, options]);

  return {
    ...state,
    startDownload,
    cancelJob,
    clearCompleted,
    refreshQueue,
  };
}

/**
 * Hook for checking API health status.
 */
export function useApiHealth() {
  const [isHealthy, setIsHealthy] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    
    try {
      await unshackleApi.healthCheck();
      setIsHealthy(true);
      setLastCheck(new Date());
    } catch (error) {
      setIsHealthy(false);
      console.error('API health check failed:', error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Check health on mount and periodically
  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkHealth]);

  return {
    isHealthy,
    isChecking,
    lastCheck,
    checkHealth,
  };
}

/**
 * Lightweight hook for starting downloads without queue management.
 * Use this in modals/components that only need to start downloads.
 */
export function useDownloadStarter(options?: { onError?: (error: UnshackleApiError) => void }) {
  const [isLoading, setIsLoading] = useState(false);

  const startDownload = useCallback(async (request: DownloadRequest): Promise<DownloadResponse> => {
    setIsLoading(true);

    try {
      const response = await unshackleApi.startDownload(request);
      setIsLoading(false);
      return response;
    } catch (err) {
      setIsLoading(false);
      const error = err instanceof UnshackleApiError ? err : new UnshackleApiError(
        err instanceof Error ? err.message : 'Failed to start download'
      );
      options?.onError?.(error);
      throw error;
    }
  }, [options]);

  return {
    startDownload,
    isLoading,
  };
}