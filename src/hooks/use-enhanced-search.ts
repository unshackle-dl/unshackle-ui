import { useQuery, useQueries } from '@tanstack/react-query';
import { apiClientManager } from '@/lib/api/api-client-manager';
import { queryKeys } from '@/lib/api/query-client';
import type { EnhancedSearchResult, SearchResult, TMDBSearchResult } from '@/lib/types';

interface UseEnhancedSearchParams {
  query: string;
  services: string[];
  contentTypes?: Array<'movie' | 'tv' | 'music'>;
  enabled?: boolean;
}

interface UseEnhancedSearchResult {
  results: EnhancedSearchResult[];
  isLoading: boolean;
  error: string | null;
  tmdbResults: TMDBSearchResult[];
  serviceResults: Record<string, SearchResult[]>;
  serviceErrors: Record<string, string | null>;
}

export function useEnhancedSearch({
  query,
  services,
  contentTypes = ['movie', 'tv'],
  enabled = true,
}: UseEnhancedSearchParams): UseEnhancedSearchResult {
  const trimmedQuery = query.trim();
  const shouldSearch = enabled && trimmedQuery.length > 0 && services.length > 0;

  // TMDB Search with proper error handling
  const tmdbQuery = useQuery({
    queryKey: queryKeys.tmdb.search(trimmedQuery, 1),
    queryFn: async (): Promise<TMDBSearchResult[]> => {
      try {
        const client = apiClientManager.getTMDBClient();
        const results = await client.searchMulti(trimmedQuery, 1);
        // Filter to only movies and TV shows as per the documentation
        return results.filter(result => 
          result.media_type === 'movie' || result.media_type === 'tv'
        );
      } catch (error) {
        console.warn('TMDB search failed:', error);
        return []; // Return empty array if TMDB fails, don't block Unshackle results
      }
    },
    enabled: shouldSearch,
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 1, // Only retry once for TMDB
  });

  // Unshackle Service Searches using useQueries for better performance
  const serviceQueries = useQueries({
    queries: services.map(serviceId => ({
      queryKey: queryKeys.unshackle.search({ service: serviceId, query: trimmedQuery }),
      queryFn: async (): Promise<SearchResult[]> => {
        const client = apiClientManager.getUnshackleClient();
        return await client.search({
          service: serviceId,
          query: trimmedQuery,
          type: contentTypes.includes('movie') && contentTypes.includes('tv') 
            ? undefined // Search all types if both selected
            : contentTypes.includes('movie') ? 'movie' 
            : contentTypes.includes('tv') ? 'tv' 
            : undefined
        });
      },
      enabled: shouldSearch,
      staleTime: 10 * 60 * 1000, // 10 minutes
      retry: 2, // Retry failed service searches
    })),
  });

  // Process results and create enhanced results
  const enhancedResults: EnhancedSearchResult[] = [];
  const serviceResults: Record<string, SearchResult[]> = {};
  const serviceErrors: Record<string, string | null> = {};

  services.forEach((serviceId, index) => {
    const serviceQuery = serviceQueries[index];
    serviceResults[serviceId] = serviceQuery.data || [];
    serviceErrors[serviceId] = serviceQuery.error ? (serviceQuery.error as Error).message : null;

    if (serviceQuery.data) {
      serviceQuery.data.forEach(result => {
        // Enhanced TMDB matching with better algorithm
        const tmdbMatch = findBestTMDBMatch(result, tmdbQuery.data || []);

        enhancedResults.push({
          unshackleResult: result,
          tmdbData: tmdbMatch,
          displayTitle: result.title,
          displayYear: result.year ? result.year.toString() : '',
          posterURL: tmdbMatch?.poster_path 
            ? apiClientManager.getTMDBClient().getPosterURL(tmdbMatch.poster_path)
            : undefined,
          backdropURL: tmdbMatch?.backdrop_path
            ? apiClientManager.getTMDBClient().getBackdropURL(tmdbMatch.backdrop_path)
            : undefined,
          description: result.description || tmdbMatch?.overview,
          rating: tmdbMatch?.vote_average,
          genres: [], // Would need to map genre_ids to names
        });
      });
    }
  });

  const isLoading = tmdbQuery.isLoading || serviceQueries.some(q => q.isLoading);
  const hasErrors = serviceQueries.some(q => q.error);
  const error = hasErrors ? 'One or more service searches failed' : null;

  return {
    results: enhancedResults,
    isLoading,
    error,
    tmdbResults: tmdbQuery.data || [],
    serviceResults,
    serviceErrors,
  };
}

// Helper function for better TMDB matching
function findBestTMDBMatch(
  unshackleResult: SearchResult, 
  tmdbResults: TMDBSearchResult[]
): TMDBSearchResult | undefined {
  if (!tmdbResults.length) return undefined;

  const normalizeTitle = (title: string): string => 
    title.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

  const unshackleTitle = normalizeTitle(unshackleResult.title);
  
  // First try exact match
  let bestMatch = tmdbResults.find(tmdbResult => {
    const tmdbTitle = normalizeTitle(tmdbResult.title || tmdbResult.name || '');
    return tmdbTitle === unshackleTitle;
  });

  if (bestMatch) return bestMatch;

  // Then try substring match with year validation if available
  bestMatch = tmdbResults.find(tmdbResult => {
    const tmdbTitle = normalizeTitle(tmdbResult.title || tmdbResult.name || '');
    const titleMatch = tmdbTitle.includes(unshackleTitle) || unshackleTitle.includes(tmdbTitle);
    
    if (!titleMatch) return false;

    // If we have year information, validate it matches
    if (unshackleResult.year && tmdbResult.release_date) {
      const tmdbYear = new Date(tmdbResult.release_date).getFullYear();
      return Math.abs(tmdbYear - unshackleResult.year) <= 1; // Allow 1 year difference
    }
    
    if (unshackleResult.year && tmdbResult.first_air_date) {
      const tmdbYear = new Date(tmdbResult.first_air_date).getFullYear();
      return Math.abs(tmdbYear - unshackleResult.year) <= 1;
    }

    return titleMatch;
  });

  return bestMatch;
}