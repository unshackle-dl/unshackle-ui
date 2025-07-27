import { QueryClient } from '@tanstack/react-query';
import { APIError, APIErrorType } from './api-errors';
import { useUIStore } from '@/stores/ui-store';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Global query defaults
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on authentication errors
        if (error instanceof APIError && error.type === APIErrorType.AUTHENTICATION_ERROR) {
          return false;
        }
        
        // Don't retry on validation errors
        if (error instanceof APIError && error.type === APIErrorType.VALIDATION_ERROR) {
          return false;
        }
        
        // Only retry retryable errors, max 3 times
        if (error instanceof APIError && error.retryable && failureCount < 3) {
          return true;
        }
        
        // Retry network errors up to 3 times
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // Global mutation defaults
      retry: (failureCount, error) => {
        // Don't retry mutations on authentication errors
        if (error instanceof APIError && error.type === APIErrorType.AUTHENTICATION_ERROR) {
          return false;
        }
        
        // Only retry network errors for mutations, max 2 times
        if (error instanceof APIError && error.type === APIErrorType.NETWORK_ERROR && failureCount < 2) {
          return true;
        }
        
        return false;
      },
      onError: (error) => {
        // Global error handling for mutations
        if (error instanceof APIError) {
          useUIStore.getState().addNotification({
            type: 'error',
            title: 'Operation Failed',
            description: error.getUserMessage(),
          });
        }
      },
    },
  },
});

// Query key factories for consistent cache keys
export const queryKeys = {
  // Unshackle API keys
  unshackle: {
    all: ['unshackle'] as const,
    services: () => [...queryKeys.unshackle.all, 'services'] as const,
    serviceConfig: (serviceId: string) => [...queryKeys.unshackle.all, 'service', serviceId, 'config'] as const,
    jobs: () => [...queryKeys.unshackle.all, 'jobs'] as const,
    job: (id: string) => [...queryKeys.unshackle.all, 'job', id] as const,
    search: (params: { service: string; query: string; type?: string }) => 
      [...queryKeys.unshackle.all, 'search', params] as const,
  },
  
  // TMDB API keys
  tmdb: {
    all: ['tmdb'] as const,
    search: (query: string, page?: number) => 
      [...queryKeys.tmdb.all, 'search', { query, page }] as const,
    searchMovies: (query: string, page?: number, year?: number) => 
      [...queryKeys.tmdb.all, 'search', 'movies', { query, page, year }] as const,
    searchTV: (query: string, page?: number, year?: number) => 
      [...queryKeys.tmdb.all, 'search', 'tv', { query, page, year }] as const,
    movie: (id: number) => [...queryKeys.tmdb.all, 'movie', id] as const,
    tv: (id: number) => [...queryKeys.tmdb.all, 'tv', id] as const,
    trending: (mediaType: string, timeWindow: string) => 
      [...queryKeys.tmdb.all, 'trending', { mediaType, timeWindow }] as const,
  },
};

// Cache management utilities
export const cacheUtils = {
  // Invalidate all Unshackle queries
  invalidateUnshackle: () => {
    return queryClient.invalidateQueries({ queryKey: queryKeys.unshackle.all });
  },
  
  // Invalidate all TMDB queries
  invalidateTMDB: () => {
    return queryClient.invalidateQueries({ queryKey: queryKeys.tmdb.all });
  },
  
  // Clear all cache
  clearAll: () => {
    queryClient.clear();
  },
  
  // Get cache size info
  getCacheInfo: () => {
    const cache = queryClient.getQueryCache();
    return {
      queryCount: cache.getAll().length,
      queries: cache.getAll().map(query => ({
        queryKey: query.queryKey,
        state: query.state.status,
        dataUpdatedAt: query.state.dataUpdatedAt,
        lastErrorUpdatedAt: query.state.errorUpdatedAt,
      })),
    };
  },
  
  // Prefetch common data
  prefetchCommonData: async () => {
    // Prefetch services list
    try {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.unshackle.services(),
        staleTime: 10 * 60 * 1000, // 10 minutes
      });
    } catch (error) {
      console.warn('Failed to prefetch services:', error);
    }
    
    // Prefetch trending content
    try {
      await queryClient.prefetchQuery({
        queryKey: queryKeys.tmdb.trending('all', 'week'),
        staleTime: 60 * 60 * 1000, // 1 hour
      });
    } catch (error) {
      console.warn('Failed to prefetch trending content:', error);
    }
  },
};

// Development helpers
if (typeof window !== 'undefined') {
  (window as any).queryClient = queryClient;
  (window as any).queryKeys = queryKeys;
  (window as any).cacheUtils = cacheUtils;
}