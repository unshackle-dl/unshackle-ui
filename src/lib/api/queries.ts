import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClientManager } from './api-client-manager';
import { queryKeys } from './query-client';
import { useUIStore } from '@/stores/ui-store';
import { useDownloadsStore } from '@/stores/downloads-store';
import { useServicesStore } from '@/stores/services-store';
import { useSearchStore } from '@/stores/search-store';
import type { 
  SearchRequest, 
  DownloadRequest, 
  ServiceInfo,
  ServiceConfig,
  ServiceAuthRequest,
  ServiceConfigRequest,
  DownloadJob,
  SearchResult,
  TMDBSearchResult 
} from '../types';

// ==================== UNSHACKLE API QUERIES ====================

export function useServices() {
  const query = useQuery({
    queryKey: queryKeys.unshackle.services(),
    queryFn: async (): Promise<ServiceInfo[]> => {
      const client = apiClientManager.getUnshackleClient();
      return await client.getServices();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update services store when data changes
  React.useEffect(() => {
    if (query.data) {
      useServicesStore.getState().setServices(query.data);
    }
  }, [query.data]);

  return query;
}

export function useJobs() {
  const query = useQuery({
    queryKey: queryKeys.unshackle.jobs(),
    queryFn: async (): Promise<DownloadJob[]> => {
      const client = apiClientManager.getUnshackleClient();
      return await client.getAllJobs();
    },
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  // Update downloads store when data changes
  React.useEffect(() => {
    if (query.data) {
      useDownloadsStore.getState().setJobs(query.data);
    }
  }, [query.data]);

  return query;
}

export function useJob(jobId: string) {
  const query = useQuery({
    queryKey: queryKeys.unshackle.job(jobId),
    queryFn: async (): Promise<DownloadJob> => {
      const client = apiClientManager.getUnshackleClient();
      return await client.getJobStatus(jobId);
    },
    enabled: !!jobId,
    refetchInterval: 2000, // Refetch every 2 seconds
  });

  // Update specific job in downloads store when data changes
  React.useEffect(() => {
    if (query.data && jobId) {
      useDownloadsStore.getState().updateJob(jobId, query.data);
    }
  }, [query.data, jobId]);

  return query;
}


export function useServiceConfig(serviceId: string) {
  return useQuery({
    queryKey: queryKeys.unshackle.serviceConfig(serviceId),
    queryFn: async (): Promise<ServiceConfig> => {
      const client = apiClientManager.getUnshackleClient();
      return await client.getServiceConfig(serviceId);
    },
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSearch(params: SearchRequest) {
  const query = useQuery({
    queryKey: queryKeys.unshackle.search(params),
    queryFn: async (): Promise<SearchResult[]> => {
      const client = apiClientManager.getUnshackleClient();
      return await client.search(params);
    },
    enabled: !!(params.service && params.query),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Update search store when data changes
  React.useEffect(() => {
    if (query.data && params.service) {
      useSearchStore.getState().setServiceResults(params.service, query.data);
    }
  }, [query.data, params.service]);

  return query;
}

// ==================== UNSHACKLE API MUTATIONS ====================

export function useStartDownload() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: DownloadRequest): Promise<string> => {
      const client = apiClientManager.getUnshackleClient();
      return await client.startDownload(params);
    },
    onSuccess: (jobId) => {
      // Invalidate jobs query to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.unshackle.jobs() });
      
      // Show success notification
      useUIStore.getState().addNotification({
        type: 'success',
        title: 'Download Started',
        description: `Download job ${jobId} has been started.`,
      });
    },
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobId: string): Promise<void> => {
      const client = apiClientManager.getUnshackleClient();
      return await client.cancelJob(jobId);
    },
    onSuccess: (_, jobId) => {
      // Remove job from downloads store
      useDownloadsStore.getState().removeJob(jobId);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: queryKeys.unshackle.jobs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.unshackle.job(jobId) });
      
      // Show success notification
      useUIStore.getState().addNotification({
        type: 'info',
        title: 'Download Cancelled',
        description: 'Download has been cancelled.',
      });
    },
  });
}

export function useTestService() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (serviceId: string): Promise<boolean> => {
      const client = apiClientManager.getUnshackleClient();
      return await client.testService(serviceId);
    },
    onSuccess: (success) => {
      // Invalidate service queries to refresh status
      queryClient.invalidateQueries({ queryKey: queryKeys.unshackle.services() });
      
      // Show notification
      useUIStore.getState().addNotification({
        type: success ? 'success' : 'error',
        title: 'Service Test',
        description: success ? 'Service connection successful' : 'Service connection failed',
      });
    },
  });
}

export function useAuthenticateService() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: ServiceAuthRequest): Promise<void> => {
      const client = apiClientManager.getUnshackleClient();
      return await client.authenticateService(params);
    },
    onSuccess: (_, params) => {
      // Invalidate service queries to refresh auth status
      queryClient.invalidateQueries({ queryKey: queryKeys.unshackle.services() });
      
      // Show success notification
      useUIStore.getState().addNotification({
        type: 'success',
        title: 'Authentication Success',
        description: `Successfully authenticated with ${params.service_id}`,
      });
    },
    onError: (error, params) => {
      // Show error notification
      useUIStore.getState().addNotification({
        type: 'error',
        title: 'Authentication Failed',
        description: `Failed to authenticate with ${params.service_id}: ${error.message}`,
      });
    },
  });
}

export function useLogoutService() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (serviceId: string): Promise<void> => {
      const client = apiClientManager.getUnshackleClient();
      return await client.logoutService(serviceId);
    },
    onSuccess: (_, serviceId) => {
      // Invalidate service queries to refresh auth status
      queryClient.invalidateQueries({ queryKey: queryKeys.unshackle.services() });
      
      // Show success notification
      useUIStore.getState().addNotification({
        type: 'info',
        title: 'Logged Out',
        description: `Successfully logged out from ${serviceId}`,
      });
    },
  });
}

export function useUpdateServiceConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: ServiceConfigRequest): Promise<void> => {
      const client = apiClientManager.getUnshackleClient();
      return await client.updateServiceConfig(params);
    },
    onSuccess: (_, params) => {
      // Invalidate service queries to refresh config
      queryClient.invalidateQueries({ queryKey: queryKeys.unshackle.services() });
      queryClient.invalidateQueries({ queryKey: queryKeys.unshackle.serviceConfig(params.service_id) });
      
      // Show success notification
      useUIStore.getState().addNotification({
        type: 'success',
        title: 'Configuration Updated',
        description: `Service configuration for ${params.service_id} has been updated`,
      });
    },
  });
}

export function useToggleService() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ serviceId, enabled }: { serviceId: string; enabled: boolean }): Promise<void> => {
      const client = apiClientManager.getUnshackleClient();
      return await client.toggleService(serviceId, enabled);
    },
    onSuccess: (_, { serviceId, enabled }) => {
      // Invalidate service queries to refresh status
      queryClient.invalidateQueries({ queryKey: queryKeys.unshackle.services() });
      
      // Show success notification
      useUIStore.getState().addNotification({
        type: 'success',
        title: `Service ${enabled ? 'Enabled' : 'Disabled'}`,
        description: `${serviceId} has been ${enabled ? 'enabled' : 'disabled'}`,
      });
    },
  });
}

// ==================== TMDB API QUERIES ====================

export function useTMDBSearch(query: string, page: number = 1) {
  const queryResult = useQuery({
    queryKey: queryKeys.tmdb.search(query, page),
    queryFn: async (): Promise<TMDBSearchResult[]> => {
      const client = apiClientManager.getTMDBClient();
      return await client.searchMulti(query, page);
    },
    enabled: !!query.trim(),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  // Update search store with TMDB results
  React.useEffect(() => {
    if (queryResult.data) {
      useSearchStore.getState().setTmdbResults(queryResult.data);
    }
  }, [queryResult.data]);

  return queryResult;
}

export function useTMDBSearchMovies(query: string, page: number = 1, year?: number) {
  return useQuery({
    queryKey: queryKeys.tmdb.searchMovies(query, page, year),
    queryFn: async (): Promise<TMDBSearchResult[]> => {
      const client = apiClientManager.getTMDBClient();
      return await client.searchMovies(query, page, year);
    },
    enabled: !!query.trim(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useTMDBSearchTV(query: string, page: number = 1, year?: number) {
  return useQuery({
    queryKey: queryKeys.tmdb.searchTV(query, page, year),
    queryFn: async (): Promise<TMDBSearchResult[]> => {
      const client = apiClientManager.getTMDBClient();
      return await client.searchTV(query, page, year);
    },
    enabled: !!query.trim(),
    staleTime: 30 * 60 * 1000,
  });
}

export function useTMDBMovieDetails(movieId: number) {
  return useQuery({
    queryKey: queryKeys.tmdb.movie(movieId),
    queryFn: async () => {
      const client = apiClientManager.getTMDBClient();
      return await client.getMovieDetails(movieId);
    },
    enabled: !!movieId,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useTMDBTVDetails(tvId: number) {
  return useQuery({
    queryKey: queryKeys.tmdb.tv(tvId),
    queryFn: async () => {
      const client = apiClientManager.getTMDBClient();
      return await client.getTVDetails(tvId);
    },
    enabled: !!tvId,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useTMDBTrending(mediaType: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'week') {
  return useQuery({
    queryKey: queryKeys.tmdb.trending(mediaType, timeWindow),
    queryFn: async (): Promise<TMDBSearchResult[]> => {
      const client = apiClientManager.getTMDBClient();
      return await client.getTrending(mediaType, timeWindow);
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

// ==================== UTILITY HOOKS ====================

export function useAPIStatus() {
  const unshackleConnection = useQuery({
    queryKey: ['api-status', 'unshackle'],
    queryFn: async () => {
      try {
        const client = apiClientManager.getUnshackleClient();
        await client.getServices();
        return 'connected';
      } catch {
        return 'disconnected';
      }
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: false,
  });

  const tmdbConnection = useQuery({
    queryKey: ['api-status', 'tmdb'],
    queryFn: async () => {
      try {
        const client = apiClientManager.getTMDBClient();
        await client.searchMulti('test', 1);
        return 'connected';
      } catch {
        return 'disconnected';
      }
    },
    refetchInterval: 60000, // Check every minute
    retry: false,
  });

  return {
    unshackle: unshackleConnection.data || 'disconnected',
    tmdb: tmdbConnection.data || 'disconnected',
    isLoading: unshackleConnection.isLoading || tmdbConnection.isLoading,
  };
}