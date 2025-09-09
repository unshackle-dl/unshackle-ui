import {
  TmdbSearchResponse,
  TmdbMovieDetails,
  TmdbTvDetails,
  TmdbFindResponse,
  ApiError,
} from '@/lib/types';
import { getCachedData, setCachedData } from '@/lib/database';
import { cacheManager, TitleMetadata } from '@/lib/cache-manager';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

export class TmdbService {
  isConfigured(): boolean {
    return !!TMDB_API_KEY;
  }

  private async makeRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!TMDB_API_KEY) {
      throw new ApiError('TMDB API key is not configured', 'Tmdb');
    }

    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', TMDB_API_KEY);

    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    const cacheKey = `tmdb:${endpoint}:${url.searchParams.toString()}`;
    const cachedResult = getCachedData<T>(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Unshackle App',
        },
      });

      if (!response.ok) {
        throw new ApiError(`TMDB API error: ${response.statusText}`, 'Tmdb', response.status);
      }

      const data = await response.json();

      const cacheTTL = endpoint.includes('search')
        ? parseInt(process.env.CACHE_TTL_SEARCH || '3600')
        : parseInt(process.env.CACHE_TTL_DETAILS || '7200');

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
      throw new ApiError(`Failed to fetch from TMDB: ${error}`, 'Tmdb');
    }
  }

  async searchMovies(query: string, page: number = 1): Promise<TmdbSearchResponse> {
    return this.makeRequest<TmdbSearchResponse>('/search/movie', {
      query,
      page: page.toString(),
      include_adult: 'false',
    });
  }

  async searchTvShows(query: string, page: number = 1): Promise<TmdbSearchResponse> {
    return this.makeRequest<TmdbSearchResponse>('/search/tv', {
      query,
      page: page.toString(),
      include_adult: 'false',
    });
  }

  async searchMulti(query: string, page: number = 1): Promise<TmdbSearchResponse> {
    return this.makeRequest<TmdbSearchResponse>('/search/multi', {
      query,
      page: page.toString(),
      include_adult: 'false',
    });
  }

  async getMovieDetails(movieId: number): Promise<TmdbMovieDetails | null> {
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] TMDB API key not configured, returning null for movie details`);
      }
      return null;
    }

    // Check enhanced metadata cache first
    const cachedMetadata = await cacheManager.getTitleMetadata(`tmdb-movie-${movieId}`);
    if (cachedMetadata && cachedMetadata.data) {
      return cachedMetadata.data as TmdbMovieDetails;
    }

    try {
      const movie = await this.makeRequest<TmdbMovieDetails>(`/movie/${movieId}`, {
        append_to_response: 'external_ids,credits',
      });

      // Add full poster URL if poster_path exists
      if (movie.poster_path) {
        (movie as TmdbMovieDetails & { posterUrl?: string }).posterUrl =
          `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`;
      }

      // Cache enhanced metadata asynchronously
      setImmediate(async () => {
        try {
          const metadata: TitleMetadata = {
            id: `tmdb-movie-${movieId}`,
            tmdbId: movieId.toString(),
            imdbId: movie.imdb_id,
            title: movie.title,
            originalTitle: movie.original_title,
            mediaType: 'movie',
            releaseYear: movie.release_date
              ? new Date(movie.release_date).getFullYear()
              : undefined,
            runtime: movie.runtime,
            genres: movie.genres?.map(g => g.name),
            countries: movie.production_countries?.map(c => c.iso_3166_1),
            data: movie,
          };
          await cacheManager.setTitleMetadata(metadata);
          if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] Cached TMDB movie metadata for ${movieId} in background`);
          }
        } catch (error) {
          console.error('Background caching error for TMDB movie metadata:', error);
        }
      });

      return movie;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[DEBUG] Failed to fetch TMDB movie details for ${movieId}:`, error);
      }
      return null;
    }
  }

  async getTvDetails(tvId: number): Promise<TmdbTvDetails | null> {
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEBUG] TMDB API key not configured, returning null for TV details`);
      }
      return null;
    }

    // Check enhanced metadata cache first
    const cachedMetadata = await cacheManager.getTitleMetadata(`tmdb-tv-${tvId}`);
    if (cachedMetadata && cachedMetadata.data) {
      return cachedMetadata.data as TmdbTvDetails;
    }

    try {
      const tv = await this.makeRequest<TmdbTvDetails>(`/tv/${tvId}`, {
        append_to_response: 'external_ids,credits',
      });

      // Add full poster URL if poster_path exists
      if (tv.poster_path) {
        (tv as TmdbTvDetails & { posterUrl?: string }).posterUrl =
          `${TMDB_IMAGE_BASE_URL}${tv.poster_path}`;
      }

      // Cache enhanced metadata asynchronously
      setImmediate(async () => {
        try {
          const metadata: TitleMetadata = {
            id: `tmdb-tv-${tvId}`,
            tmdbId: tvId.toString(),
            imdbId: tv.external_ids?.imdb_id,
            title: tv.name,
            originalTitle: tv.original_name,
            mediaType: 'tv',
            releaseYear: tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : undefined,
            genres: tv.genres?.map(g => g.name),
            countries: tv.production_countries?.map(c => c.iso_3166_1),
            data: tv,
          };
          await cacheManager.setTitleMetadata(metadata);
          if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] Cached TMDB TV metadata for ${tvId} in background`);
          }
        } catch (error) {
          console.error('Background caching error for TMDB TV metadata:', error);
        }
      });

      return tv;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[DEBUG] Failed to fetch TMDB TV details for ${tvId}:`, error);
      }
      return null;
    }
  }

  async findByExternalId(
    externalId: string,
    externalSource: string = 'imdb_id'
  ): Promise<TmdbFindResponse> {
    return this.makeRequest<TmdbFindResponse>(`/find/${externalId}`, {
      external_source: externalSource,
    });
  }

  async getConfiguration(): Promise<{
    images: {
      base_url: string;
      secure_base_url: string;
      backdrop_sizes: string[];
      logo_sizes: string[];
      poster_sizes: string[];
      profile_sizes: string[];
    };
  }> {
    return this.makeRequest('/configuration');
  }

  // Helper method to get full image URL
  getImageUrl(path: string, size: string = 'w500'): string {
    if (!path) return '';
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }

  // Helper method to format TMDB results for unified search
  formatSearchResult(result: {
    id: number;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    overview?: string;
    release_date?: string;
    first_air_date?: string;
    media_type?: string;
    vote_average: number;
    vote_count: number;
    poster_path?: string;
    genre_ids?: number[];
  }): {
    id: string;
    title: string;
    originalTitle?: string;
    overview?: string;
    releaseDate?: string;
    releaseYear?: number;
    mediaType: string;
    rating?: number;
    voteCount?: number;
    posterUrl?: string;
    tmdbId: string;
    genreIds: number[];
  } {
    const isMovie = result.media_type === 'movie' || result.title;

    return {
      id: result.id.toString(),
      title: (isMovie ? result.title : result.name) || '',
      originalTitle: isMovie ? result.original_title : result.original_name,
      overview: result.overview,
      releaseDate: isMovie ? result.release_date : result.first_air_date,
      releaseYear: isMovie
        ? new Date(result.release_date || '').getFullYear() || undefined
        : new Date(result.first_air_date || '').getFullYear() || undefined,
      mediaType: result.media_type || (isMovie ? 'movie' : 'tv'),
      rating: result.vote_average > 0 ? result.vote_average : undefined,
      voteCount: result.vote_count > 0 ? result.vote_count : undefined,
      posterUrl: result.poster_path ? this.getImageUrl(result.poster_path) : undefined,
      tmdbId: result.id.toString(),
      genreIds: result.genre_ids || [],
    };
  }
}

export const tmdbService = new TmdbService();
