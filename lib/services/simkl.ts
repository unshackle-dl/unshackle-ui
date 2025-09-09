import {
  SimklSearchResponse,
  SimklRatingResponse,
  SimklIdLookupResponse,
  ApiError,
} from '@/lib/types';
import { getCachedData, setCachedData } from '@/lib/database';
import { cacheManager, CachedRating } from '@/lib/cache-manager';

const SIMKL_BASE_URL = 'https://api.simkl.com';
const SIMKL_API_KEY = process.env.SIMKL_API_KEY;

export class SimklService {
  isConfigured(): boolean {
    return !!SIMKL_API_KEY;
  }

  private async makeRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!SIMKL_API_KEY) {
      throw new ApiError('SIMKL API key is not configured', 'Simkl');
    }

    const url = new URL(`${SIMKL_BASE_URL}${endpoint}`);

    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    const cacheKey = `simkl:${endpoint}:${url.searchParams.toString()}`;
    const cachedResult = getCachedData<T>(cacheKey);

    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SIMKL DEBUG] Making request to: ${url.toString()}`);
      if (cachedResult) {
        console.log(`[SIMKL DEBUG] Using cached result for: ${endpoint}`);
      }
    }

    if (cachedResult) {
      return cachedResult;
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Unshackle App',
          'simkl-api-key': SIMKL_API_KEY,
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new ApiError('SIMKL API rate limit exceeded', 'Simkl', response.status);
        }
        throw new ApiError(`SIMKL API error: ${response.statusText}`, 'Simkl', response.status);
      }

      const data = await response.json();

      // Debug logging in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[SIMKL DEBUG] Response from ${endpoint}:`, {
          status: response.status,
          dataType: Array.isArray(data) ? `array[${data.length}]` : typeof data,
          hasIds: data?.ids ? 'yes' : 'no',
          hasRatings: data?.ratings ? 'yes' : 'no',
        });
      }

      const cacheTTL = endpoint.includes('search')
        ? parseInt(process.env.CACHE_TTL_SEARCH || '3600')
        : parseInt(process.env.CACHE_TTL_RATINGS || '86400');

      // Cache asynchronously - don't block the response
      setImmediate(() => {
        try {
          setCachedData(cacheKey, data, cacheTTL);
        } catch (error) {
          console.error('Background caching error:', error);
        }
      });

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to fetch from SIMKL: ${error}`, 'Simkl');
    }
  }

  async search(query: string, type: string = 'all'): Promise<SimklSearchResponse[]> {
    const endpoint = type === 'all' ? '/search/' : `/search/${type}`;

    return this.makeRequest<SimklSearchResponse[]>(endpoint, {
      q: query,
      limit: process.env.MAX_RESULTS_PER_SOURCE || '20',
    });
  }

  async searchMovies(query: string): Promise<SimklSearchResponse[]> {
    return this.search(query, 'movie');
  }

  async searchShows(query: string): Promise<SimklSearchResponse[]> {
    return this.search(query, 'show');
  }

  async getRatingsByImdbId(
    imdbId: string,
    sources: string = 'simkl,ext,rank'
  ): Promise<SimklRatingResponse | null> {
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] SIMKL API key not configured, returning null for ratings`);
      }
      return null;
    }

    // Check enhanced cache first
    const cachedRatings = await cacheManager.getRatings(imdbId);
    if (cachedRatings && cachedRatings.length > 0) {
      const simklRating = cachedRatings.find(r => r.source === 'simkl');
      if (simklRating) {
        return simklRating.data as SimklRatingResponse;
      }
    }

    try {
      // Remove 'tt' prefix if present
      const cleanImdbId = imdbId.startsWith('tt') ? imdbId.substring(2) : imdbId;

      const rating = await this.makeRequest<SimklRatingResponse>(`/ratings/${cleanImdbId}`, {
        sources,
      });

      // Cache the rating asynchronously in the enhanced cache
      if (rating) {
        setImmediate(async () => {
          try {
            const cachedRating: CachedRating = {
              imdbId,
              source: 'simkl',
              rating: rating.simkl?.rating,
              voteCount: rating.simkl?.votes,
              data: rating,
            };
            await cacheManager.setRating(cachedRating);
            if (process.env.NODE_ENV === 'development') {
              console.log(`[DEBUG] Cached SIMKL rating for ${imdbId} in background`);
            }
          } catch (error) {
            console.error('Background caching error for SIMKL rating:', error);
          }
        });
      }

      return rating;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[DEBUG] Failed to fetch SIMKL ratings for ${imdbId}:`, error);
      }
      return null;
    }
  }

  async lookupById(externalId: string, idType: string = 'imdb'): Promise<SimklIdLookupResponse> {
    // Clean the external ID based on type
    let cleanId = externalId;
    if (idType === 'imdb' && externalId.startsWith('tt')) {
      cleanId = externalId.substring(2);
    }

    return this.makeRequest<SimklIdLookupResponse>(`/search/id`, {
      [idType]: cleanId,
      client_id: SIMKL_API_KEY || '',
    });
  }

  async searchById(
    externalId: string,
    idType: 'imdb' | 'tmdb' = 'imdb',
    mediaType?: 'movie' | 'tv'
  ): Promise<SimklIdLookupResponse> {
    // Clean the external ID based on type
    let cleanId = externalId;
    if (idType === 'imdb' && externalId.startsWith('tt')) {
      cleanId = externalId.substring(2);
    }

    const params: Record<string, string> = {
      [idType]: cleanId,
      client_id: SIMKL_API_KEY || '',
    };

    // Add type parameter for TMDB searches
    if (idType === 'tmdb' && mediaType) {
      params.type = mediaType === 'tv' ? 'tv' : 'movie';
    }

    return this.makeRequest<SimklIdLookupResponse>(`/search/id`, params);
  }

  async getDetails(simklId: number, type: 'movie' | 'show'): Promise<Record<string, unknown>> {
    return this.makeRequest(`/${type}/${simklId}`, {
      extended: 'full',
    });
  }

  async getDetailsByImdbId(
    imdbId: string,
    mediaType: 'movie' | 'tv'
  ): Promise<Record<string, unknown> | null> {
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] SIMKL API key not configured, returning null for details`);
      }
      return null;
    }

    // Check enhanced cache first
    const cachedRatings = await cacheManager.getRatings(imdbId);
    if (cachedRatings && cachedRatings.length > 0) {
      const simklDetails = cachedRatings.find(r => r.source === 'simkl-details');
      if (simklDetails) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[DEBUG] Using cached SIMKL details for ${imdbId}`);
        }
        return simklDetails.data as Record<string, unknown>;
      }
    }

    try {
      // Don't remove 'tt' prefix for this endpoint
      const endpoint = mediaType === 'tv' ? '/tv/' : '/movies/';

      const details = await this.makeRequest(`${endpoint}${imdbId}`, {
        extended: 'full',
        client_id: SIMKL_API_KEY || '',
      });

      // Cache the detailed data separately
      if (details) {
        setImmediate(async () => {
          try {
            const cachedDetails: CachedRating = {
              imdbId,
              source: 'simkl-details',
              rating: (details as Record<string, any>).ratings?.simkl?.rating,
              voteCount: (details as Record<string, any>).ratings?.simkl?.votes,
              data: details,
            };
            await cacheManager.setRating(cachedDetails);
            if (process.env.NODE_ENV === 'development') {
              console.log(`[DEBUG] Cached SIMKL details for ${imdbId} in background`);
            }
          } catch (error) {
            console.error('Background caching error for SIMKL details:', error);
          }
        });
      }

      return details as Record<string, unknown>;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[DEBUG] Failed to fetch SIMKL details for ${imdbId}:`, error);
      }
      return null;
    }
  }

  async getEpisodes(simklId: number): Promise<unknown[]> {
    // Check cache first using simklId as key
    const cacheKey = `simkl-episodes-${simklId}`;
    const { getCachedData } = await import('@/lib/database');
    const cachedEpisodes = getCachedData<unknown[]>(cacheKey);

    if (cachedEpisodes) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[SIMKL DEBUG] Using cached episodes for SIMKL ID: ${simklId}`);
      }
      return cachedEpisodes;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[SIMKL DEBUG] Fetching episodes for SIMKL ID: ${simklId}`);
    }

    const episodes = await this.makeRequest<unknown[]>(`/tv/episodes/${simklId}`, {
      client_id: SIMKL_API_KEY || '',
    });

    // Cache episodes asynchronously
    if (episodes) {
      setImmediate(async () => {
        try {
          const { setCachedData } = await import('@/lib/database');
          const cacheTTL = parseInt(process.env.CACHE_TTL_DETAILS || '7200');
          setCachedData(cacheKey, episodes, cacheTTL);
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `[DEBUG] Cached ${episodes.length} episodes for SIMKL ID ${simklId} in background`
            );
          }
        } catch (error) {
          console.error('Background caching error for episodes:', error);
        }
      });
    }

    return episodes;
  }

  // Helper method to format SIMKL results for unified search
  formatSearchResult(result: SimklSearchResponse): {
    id: string;
    title: string;
    originalTitle?: string;
    releaseYear?: number;
    mediaType: string;
    posterUrl?: string;
    simklId: string;
    imdbId?: string;
    tmdbId?: string;
  } {
    return {
      id: result.ids?.simkl?.toString() || '',
      title: result.title,
      releaseYear: result.year,
      mediaType: result.type === 'show' ? 'tv' : result.type,
      posterUrl: result.poster,
      imdbId: result.ids?.imdb,
      tmdbId: result.ids?.tmdb?.toString(),
      simklId: result.ids?.simkl?.toString() || '',
    };
  }

  // Helper method to check if ratings are available
  hasValidRatings(ratings: SimklRatingResponse | null): boolean {
    if (!ratings) return false;
    return !!(ratings.simkl?.rating || ratings.external?.imdb?.rating);
  }

  // Get popular TV premieres
  async getTvPremieres(type: 'new' | 'soon' = 'new'): Promise<SimklSearchResponse[]> {
    return this.makeRequest<SimklSearchResponse[]>('/tv/premieres/' + type, {
      client_id: SIMKL_API_KEY || '',
    });
  }

  // Get popular movies
  async getPopularMovies(): Promise<SimklSearchResponse[]> {
    return this.makeRequest<SimklSearchResponse[]>('/movies/popular', {
      client_id: SIMKL_API_KEY || '',
      limit: '10',
    });
  }

  // Get trending content
  async getTrending(type: 'all' | 'movies' | 'shows' = 'all'): Promise<SimklSearchResponse[]> {
    const endpoint = type === 'all' ? '/trending' : `/trending/${type}`;
    return this.makeRequest<SimklSearchResponse[]>(endpoint, {
      client_id: SIMKL_API_KEY || '',
      limit: '10',
    });
  }

  // Helper method to get best available rating
  getBestRating(
    ratings: SimklRatingResponse | null
  ): { source: string; rating: number; votes: number } | null {
    if (!ratings) return null;

    if (ratings.simkl?.rating && ratings.simkl.votes > 0) {
      return {
        source: 'SIMKL',
        rating: ratings.simkl.rating,
        votes: ratings.simkl.votes,
      };
    }

    if (ratings.external?.imdb?.rating && ratings.external.imdb.votes > 0) {
      return {
        source: 'IMDb',
        rating: ratings.external.imdb.rating,
        votes: ratings.external.imdb.votes,
      };
    }

    return null;
  }
}

export const simklService = new SimklService();
