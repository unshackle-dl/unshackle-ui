import { type TMDBSearchResult, type TMDBMovieDetails, type TMDBTVDetails } from '../types';
import { APIError, APIErrorType } from './api-errors';

export class TMDBClient {
  private apiKey: string;
  private baseURL = 'https://api.themoviedb.org/3';
  private imageBaseURL = 'https://image.tmdb.org/t/p';
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const url = new URL(`${this.baseURL}${endpoint}`);
    url.searchParams.set('api_key', this.apiKey);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw APIError.fromResponse(response, errorData);
      }

      return response.json();
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      if (error instanceof Error) {
        throw APIError.fromNetworkError(error);
      }
      
      throw new APIError(
        APIErrorType.UNKNOWN_ERROR,
        'An unexpected error occurred',
        undefined,
        undefined,
        error
      );
    }
  }

  // Cache management
  private setCache(key: string, value: any): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
    });
  }

  private getCache(key: string): any | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    if (Date.now() - item.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  // Multi search across movies, TV shows, and people
  async searchMulti(query: string, page: number = 1): Promise<TMDBSearchResult[]> {
    const cacheKey = `search:${query}:${page}`;
    const cached = this.getCache(cacheKey);

    if (cached) {
      return cached;
    }

    const response = await this.request<{ results: TMDBSearchResult[] }>('/search/multi', {
      query,
      page,
      include_adult: false,
    });

    // Filter to only movies and TV shows
    const results = response.results.filter(result => 
      result.media_type === 'movie' || result.media_type === 'tv'
    );

    this.setCache(cacheKey, results);
    return results;
  }

  // Get movie details
  async getMovieDetails(movieId: number): Promise<TMDBMovieDetails> {
    const cacheKey = `movie:${movieId}`;
    const cached = this.getCache(cacheKey);

    if (cached) {
      return cached;
    }

    const details = await this.request<TMDBMovieDetails>(`/movie/${movieId}`);
    this.setCache(cacheKey, details);
    return details;
  }

  // Get TV show details
  async getTVDetails(tvId: number): Promise<TMDBTVDetails> {
    const cacheKey = `tv:${tvId}`;
    const cached = this.getCache(cacheKey);

    if (cached) {
      return cached;
    }

    const details = await this.request<TMDBTVDetails>(`/tv/${tvId}`);
    this.setCache(cacheKey, details);
    return details;
  }

  // Image URL construction
  getPosterURL(path: string, size: string = 'w500'): string {
    return `${this.imageBaseURL}/${size}${path}`;
  }

  getBackdropURL(path: string, size: string = 'w1280'): string {
    return `${this.imageBaseURL}/${size}${path}`;
  }

  // Get multiple sizes for responsive images
  getResponsivePosterSizes(path: string): {
    small: string;
    medium: string;
    large: string;
  } {
    return {
      small: this.getPosterURL(path, 'w154'),
      medium: this.getPosterURL(path, 'w342'),
      large: this.getPosterURL(path, 'w500'),
    };
  }

  // Search with different content types
  async searchMovies(query: string, page: number = 1, year?: number): Promise<TMDBSearchResult[]> {
    const cacheKey = `search:movies:${query}:${page}:${year || ''}`;
    const cached = this.getCache(cacheKey);

    if (cached) {
      return cached;
    }

    const params: any = {
      query,
      page,
      include_adult: false,
    };

    if (year) {
      params.primary_release_year = year;
    }

    const response = await this.request<{ results: TMDBSearchResult[] }>('/search/movie', params);
    
    this.setCache(cacheKey, response.results);
    return response.results;
  }

  async searchTV(query: string, page: number = 1, year?: number): Promise<TMDBSearchResult[]> {
    const cacheKey = `search:tv:${query}:${page}:${year || ''}`;
    const cached = this.getCache(cacheKey);

    if (cached) {
      return cached;
    }

    const params: any = {
      query,
      page,
      include_adult: false,
    };

    if (year) {
      params.first_air_date_year = year;
    }

    const response = await this.request<{ results: TMDBSearchResult[] }>('/search/tv', params);
    
    this.setCache(cacheKey, response.results);
    return response.results;
  }

  // Find movie by external ID (e.g., IMDB ID)
  async findByExternalId(externalId: string, source: 'imdb_id' | 'tvdb_id' = 'imdb_id'): Promise<any> {
    const cacheKey = `find:${source}:${externalId}`;
    const cached = this.getCache(cacheKey);

    if (cached) {
      return cached;
    }

    const response = await this.request<any>(`/find/${externalId}`, {
      external_source: source,
    });

    this.setCache(cacheKey, response);
    return response;
  }

  // Get trending content
  async getTrending(mediaType: 'all' | 'movie' | 'tv' = 'all', timeWindow: 'day' | 'week' = 'week'): Promise<TMDBSearchResult[]> {
    const cacheKey = `trending:${mediaType}:${timeWindow}`;
    const cached = this.getCache(cacheKey);

    if (cached) {
      return cached;
    }

    const response = await this.request<{ results: TMDBSearchResult[] }>(`/trending/${mediaType}/${timeWindow}`);
    
    this.setCache(cacheKey, response.results);
    return response.results;
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Get cache size for debugging
  getCacheSize(): number {
    return this.cache.size;
  }
}