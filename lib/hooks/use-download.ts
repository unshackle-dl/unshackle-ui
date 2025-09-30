/**
 * React hook for managing downloads with the Unshackle API.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  unshackleApi,
  UnshackleApiError,
  DownloadRequest,
  DownloadResponse,
  DownloadJob,
  DownloadQueueResponse,
  ServiceMatch,
  TrackListingResponse,
  ServicesResponse,
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

// Service cache to avoid fetching services list multiple times
let servicesCache: ServicesResponse | null = null;
let servicesCachePromise: Promise<ServicesResponse> | null = null;

/**
 * Get services list with caching to avoid multiple API calls.
 */
async function getCachedServices(): Promise<ServicesResponse> {
  // Return cached services if available
  if (servicesCache) {
    console.log('[getCachedServices] Returning cached services');
    return servicesCache;
  }

  // If a fetch is already in progress, wait for it
  if (servicesCachePromise) {
    console.log('[getCachedServices] Waiting for in-progress fetch');
    return servicesCachePromise;
  }

  // Start a new fetch
  console.log('[getCachedServices] Fetching services from API');
  servicesCachePromise = unshackleApi.getServices().then(services => {
    servicesCache = services;
    servicesCachePromise = null;
    console.log('[getCachedServices] Cached services:', services);
    return services;
  });

  return servicesCachePromise;
}

/**
 * Hook for checking streaming service availability.
 * Matches URLs against supported services by fetching service list and pattern matching.
 * Uses a shared cache to avoid multiple API requests.
 */
export function useServiceAvailability() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAvailability = useCallback(async (urls: string[]): Promise<ServiceMatch[]> => {
    console.log('[useServiceAvailability] Starting availability check for URLs:', urls);
    setIsLoading(true);
    setError(null);

    try {
      const servicesResponse = await getCachedServices();
      console.log('[useServiceAvailability] Using services (from cache or API):', servicesResponse);

      const matches: ServiceMatch[] = urls.map(url => {
        // Try to match URL against each service's domain patterns
        // servicesResponse.services is an array of service objects
        for (const serviceInfo of servicesResponse.services) {
          // Extract domain from URL
          const urlDomain = new URL(url).hostname.toLowerCase();

          // Check if service tag or aliases match domain patterns
          const servicePatterns = [
            serviceInfo.tag.toLowerCase(),
            ...(serviceInfo.aliases || []).map((a: string) => a.toLowerCase()),
          ];

          // Common domain patterns for streaming services
          const domainPatterns = servicePatterns.flatMap(pattern => [
            pattern,
            `www.${pattern}`,
            `${pattern}.com`,
            `www.${pattern}.com`,
          ]);

          const matched = domainPatterns.some(
            pattern =>
              urlDomain.includes(pattern) || pattern.includes(urlDomain.replace('www.', ''))
          );

          if (matched) {
            console.log('[useServiceAvailability] Matched URL', url, 'to service', serviceInfo.tag);
            return {
              url,
              supported: true,
              service: serviceInfo.tag,
              geofenced: (serviceInfo.geofence && serviceInfo.geofence.length > 0) || false,
            };
          }
        }

        console.log('[useServiceAvailability] No match found for URL:', url);
        return {
          url,
          supported: false,
          service: null,
          geofenced: false,
        };
      });

      console.log('[useServiceAvailability] Final matches:', matches);
      return matches;
    } catch (err) {
      console.error('[useServiceAvailability] API call failed:', err);
      const errorMessage =
        err instanceof UnshackleApiError ? err.message : 'Failed to check availability';
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

// Track cache to avoid re-fetching the same tracks
// Key format: `${service}|${url}|${region}|${type}|${season}|${episode}`
const tracksCache = new Map<string, { data: TrackListingResponse; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate cache key for track listing
 */
function getTrackCacheKey(
  service: string,
  url: string,
  options?: {
    type?: 'all' | 'season' | 'episode';
    season?: number;
    episode?: number;
    profile?: string;
    proxy?: string;
  }
): string {
  const region = options?.proxy || 'default';
  const type = options?.type || 'all';
  const season = options?.season || 'none';
  const episode = options?.episode || 'none';
  return `${service}|${url}|${region}|${type}|${season}|${episode}`;
}

/**
 * Hook for listing available tracks with region-aware caching.
 */
export function useTrackListing() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackListingResponse | null>(null);

  const listTracks = useCallback(
    async (
      service: string,
      url: string,
      options?: {
        type?: 'all' | 'season' | 'episode';
        season?: number;
        episode?: number;
        profile?: string;
        proxy?: string;
        forceRefresh?: boolean;
      }
    ): Promise<TrackListingResponse> => {
      const cacheKey = getTrackCacheKey(service, url, options);

      // Check cache first (unless forceRefresh is true)
      if (!options?.forceRefresh) {
        const cached = tracksCache.get(cacheKey);
        if (cached) {
          const age = Date.now() - cached.timestamp;
          if (age < CACHE_TTL) {
            console.log(
              `[useTrackListing] Using cached tracks (age: ${Math.round(age / 1000)}s):`,
              cacheKey
            );
            setTracks(cached.data);
            return cached.data;
          } else {
            console.log(
              `[useTrackListing] Cache expired (age: ${Math.round(age / 1000)}s), fetching fresh:`,
              cacheKey
            );
            tracksCache.delete(cacheKey);
          }
        }
      } else {
        console.log(`[useTrackListing] Force refresh requested:`, cacheKey);
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log(`[useTrackListing] Fetching tracks from API:`, cacheKey);
        const request: any = {
          service,
          title_id: url, // New API uses title_id instead of url
          profile: options?.profile,
          proxy: options?.proxy,
        };

        // Handle episode selection based on type
        if (options?.type === 'season' && options.season !== undefined) {
          request.season = options.season;
        } else if (
          options?.type === 'episode' &&
          options.season !== undefined &&
          options.episode !== undefined
        ) {
          // Format as S01E01 (pad with zeros to 2 digits)
          const seasonStr = String(options.season).padStart(2, '0');
          const episodeStr = String(options.episode).padStart(2, '0');
          request.wanted = `S${seasonStr}E${episodeStr}`;
        }
        // 'all' type doesn't need additional parameters

        const response = await unshackleApi.listTracks(request);

        // Normalize response to match expected format
        let normalizedResponse: TrackListingResponse;

        if (response.episodes) {
          // Multiple episodes response
          normalizedResponse = {
            episodes: response.episodes.map(ep => ({
              season: ep.title.season || 1,
              episode: ep.title.number || 1,
              title: ep.title.name,
              video_tracks: ep.video,
              audio_tracks: ep.audio,
              subtitle_tracks: ep.subtitles,
            })),
          };
        } else if (response.title) {
          // Single title response - wrap in episodes array for consistency
          normalizedResponse = {
            title: response.title,
            video: response.video,
            audio: response.audio,
            subtitles: response.subtitles,
            episodes: [
              {
                season: response.title.season || 1,
                episode: response.title.number || 1,
                title: response.title.name,
                video_tracks: response.video || [],
                audio_tracks: response.audio || [],
                subtitle_tracks: response.subtitles || [],
              },
            ],
          };
        } else {
          normalizedResponse = response;
        }

        // Store in cache
        tracksCache.set(cacheKey, {
          data: normalizedResponse,
          timestamp: Date.now(),
        });
        console.log(`[useTrackListing] Cached tracks:`, cacheKey);

        setTracks(normalizedResponse);
        return normalizedResponse;
      } catch (err) {
        const errorMessage =
          err instanceof UnshackleApiError ? err.message : 'Failed to list tracks';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearTracks = useCallback(() => {
    setTracks(null);
    setError(null);
  }, []);

  const clearCache = useCallback((region?: string) => {
    if (region) {
      // Clear cache entries for specific region
      const keysToDelete: string[] = [];
      tracksCache.forEach((_, key) => {
        if (key.includes(`|${region}|`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => tracksCache.delete(key));
      console.log(
        `[useTrackListing] Cleared cache for region: ${region} (${keysToDelete.length} entries)`
      );
    } else {
      // Clear all cache
      tracksCache.clear();
      console.log(`[useTrackListing] Cleared all cache`);
    }
  }, []);

  return {
    listTracks,
    clearTracks,
    clearCache,
    tracks,
    isLoading,
    error,
  };
}

/**
 * Main download management hook.
 * Uses polling instead of WebSocket for job status updates.
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

  const previousActiveJobProgress = useRef<number | undefined>();

  // Refresh download queue (shared function)
  const refreshQueue = useCallback(async () => {
    try {
      const queueData = await unshackleApi.getDownloadQueue();

      // Track progress changes for callbacks
      const newProgress = queueData.active?.progress;
      if (newProgress !== undefined && newProgress !== previousActiveJobProgress.current) {
        if (queueData.active) {
          options?.onProgress?.(queueData.active.job_id, newProgress);
        }
        previousActiveJobProgress.current = newProgress;
      }

      // Check for completed jobs
      if (queueData.active?.status === 'completed') {
        options?.onComplete?.(queueData.active.job_id);
      }

      setState(prev => ({
        ...prev,
        activeJob: queueData.active,
        queue: queueData.queued,
        completed: queueData.completed,
        isConnected: true, // Successfully fetched data, so we're connected
        error: null,
      }));
    } catch (err) {
      const errorMessage =
        err instanceof UnshackleApiError ? err.message : 'Failed to refresh queue';
      setState(prev => ({ ...prev, error: errorMessage, isConnected: false }));
      options?.onError?.(
        err instanceof UnshackleApiError ? err : new UnshackleApiError(errorMessage)
      );
    }
  }, [options]);

  // Auto-refresh queue every 5 seconds when there's an active job or items in queue
  useEffect(() => {
    if (!state.activeJob && state.queue.length === 0) {
      return;
    }

    const interval = setInterval(refreshQueue, 5000);
    return () => clearInterval(interval);
  }, [refreshQueue, state.activeJob, state.queue.length]);

  // Initial queue load on mount - only refresh once
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      refreshQueue();
      hasInitialized.current = true;
    }
  }, [refreshQueue]);

  // Start a download
  const startDownload = useCallback(
    async (request: DownloadRequest): Promise<DownloadResponse> => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await unshackleApi.startDownload(request);

        // Refresh queue to show the new job
        await refreshQueue();

        setState(prev => ({ ...prev, isLoading: false }));
        return response;
      } catch (err) {
        const errorMessage =
          err instanceof UnshackleApiError ? err.message : 'Failed to start download';
        setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));

        const error = err instanceof UnshackleApiError ? err : new UnshackleApiError(errorMessage);
        options?.onError?.(error);
        throw error;
      }
    },
    [refreshQueue, options]
  );

  // Cancel a download job
  const cancelJob = useCallback(
    async (jobId: string): Promise<void> => {
      try {
        await unshackleApi.cancelJob(jobId);

        // Refresh queue
        await refreshQueue();
      } catch (err) {
        const errorMessage =
          err instanceof UnshackleApiError ? err.message : 'Failed to cancel job';
        setState(prev => ({ ...prev, error: errorMessage }));

        const error = err instanceof UnshackleApiError ? err : new UnshackleApiError(errorMessage);
        options?.onError?.(error);
        throw error;
      }
    },
    [refreshQueue, options]
  );

  // Clear completed jobs
  const clearCompleted = useCallback(async (): Promise<void> => {
    try {
      await unshackleApi.clearCompletedJobs();
      await refreshQueue();
    } catch (err) {
      const errorMessage =
        err instanceof UnshackleApiError ? err.message : 'Failed to clear completed jobs';
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
 * Only checks once on mount - use checkHealth() to manually refresh.
 */
export function useApiHealth(options?: { autoRefresh?: boolean; refreshInterval?: number }) {
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

  // Check health on mount only
  const hasChecked = useRef(false);
  useEffect(() => {
    if (!hasChecked.current) {
      checkHealth();
      hasChecked.current = true;
    }
  }, [checkHealth]);

  // Optional periodic refresh (disabled by default)
  useEffect(() => {
    if (!options?.autoRefresh) return;

    const interval = setInterval(checkHealth, options.refreshInterval || 60000);
    return () => clearInterval(interval);
  }, [checkHealth, options?.autoRefresh, options?.refreshInterval]);

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

  const startDownload = useCallback(
    async (request: DownloadRequest): Promise<DownloadResponse> => {
      setIsLoading(true);

      try {
        const response = await unshackleApi.startDownload(request);
        setIsLoading(false);
        return response;
      } catch (err) {
        setIsLoading(false);
        const error =
          err instanceof UnshackleApiError
            ? err
            : new UnshackleApiError(
                err instanceof Error ? err.message : 'Failed to start download'
              );
        options?.onError?.(error);
        throw error;
      }
    },
    [options]
  );

  return {
    startDownload,
    isLoading,
  };
}
