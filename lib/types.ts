// API Source types
export type ApiSource = 'JustWatch' | 'Tmdb' | 'Simkl';

// Search configuration
export interface SearchConfiguration {
  enabledSources: ApiSource[];
  country?: string;
  maxResultsPerSource: number;
  deduplicateResults: boolean;
  mediaTypeFilter?: string;
}

// Unified search result
export interface UnifiedSearchResult {
  id: string;
  source: ApiSource;
  title: string;
  originalTitle?: string;
  overview?: string;
  releaseDate?: string;
  releaseYear?: number;
  mediaType: string;
  rating?: number;
  voteCount?: number;
  posterUrl?: string;
  genres: string[];
  imdbId?: string;
  tmdbId?: string;
  simklId?: string;
  runtime?: number;
  totalEpisodes?: number;
  justWatchUrl?: string;
  countries?: string[];
}

// Unified search response
export interface UnifiedSearchResponse {
  results: UnifiedSearchResult[];
  totalResults: number;
  resultsBySource: Record<ApiSource, number>;
  errors: Record<ApiSource, string>;
}

// Popular content response
export interface PopularContentResponse {
  movies: UnifiedSearchResult[];
  tvShows: UnifiedSearchResult[];
  totalMovies: number;
  totalTvShows: number;
  sources: ApiSource[];
  errors: Record<ApiSource, string>;
}

// JustWatch types
export interface JustWatchSearchResponse {
  data: {
    popularTitles: {
      edges: Array<{
        node: JustWatchTitle;
      }>;
    };
  };
}

export interface JustWatchTitle {
  id: string;
  objectType: string;
  content: {
    title: string;
    originalReleaseYear?: number;
    fullPath?: string;
    externalIds?: {
      imdbId?: string;
      tmdbId?: string;
    };
    productionCountries?: string[];
    genres?: Array<{ shortName: string }>;
    runtime?: number;
    posterUrl?: string;
  };
}

// TMDB types
export interface TmdbSearchResponse {
  page: number;
  results: TmdbSearchResult[];
  total_results: number;
  total_pages: number;
}

export interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  poster_path?: string;
  media_type?: string;
  genre_ids?: number[];
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  original_title: string;
  overview?: string;
  release_date?: string;
  vote_average: number;
  vote_count: number;
  poster_path?: string;
  runtime?: number;
  genres: Array<{ id: number; name: string }>;
  imdb_id?: string;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
}

export interface TmdbTvDetails {
  id: number;
  name: string;
  original_name: string;
  overview?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  poster_path?: string;
  genres: Array<{ id: number; name: string }>;
  number_of_episodes?: number;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  external_ids?: {
    imdb_id?: string;
  };
}

export interface TmdbFindResponse {
  movie_results: TmdbSearchResult[];
  tv_results: TmdbSearchResult[];
  person_results: unknown[];
}

// SIMKL types
export interface SimklSearchResponse {
  title: string;
  year?: number;
  ids: {
    simkl?: number;
    imdb?: string;
    tmdb?: number;
  };
  poster?: string;
  type: string;
}

export interface SimklRatingResponse {
  simkl?: {
    rating: number;
    votes: number;
  };
  external?: {
    imdb?: {
      rating: number;
      votes: number;
    };
  };
}

export interface SimklIdLookupResponse {
  movies?: SimklSearchResponse[];
  shows?: SimklSearchResponse[];
}

// Title offers and pricing
export interface TitleOffer {
  id: string;
  country: string;
  provider: string;
  monetization_type: string;
  retail_price?: number;
  currency: string;
  presentation_type: string;
  urls: {
    standard_web: string;
  };
}

export interface TitleOfferViewModel {
  title: JustWatchTitle;
  offers: TitleOffer[];
  groupedOffers: Record<string, TitleOffer[]>;
}

// Currency conversion
export interface CurrencyRate {
  from: string;
  to: string;
  rate: number;
  lastUpdated: Date;
}

// Database result types
export interface DatabaseCacheEntry {
  key: string;
  value: string;
  expires_at: number;
  created_at: number;
}

export interface DatabaseSearchHistoryEntry {
  id: number;
  query: string;
  country: string;
  results_count: number;
  created_at: number;
}

export interface DatabaseTitleCacheEntry {
  id: string;
  source: string;
  data: string;
  expires_at: number;
  created_at: number;
}

export interface DatabaseStreamingOfferEntry {
  id: string;
  title_id: string;
  country: string;
  provider: string;
  monetization_type: string;
  retail_price: number | null;
  currency: string;
  presentation_type: string;
  url: string;
  expires_at: number;
  created_at: number;
}

export interface DatabaseRatingEntry {
  imdb_id: string;
  simkl_rating: number | null;
  simkl_votes: number | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  expires_at: number;
  created_at: number;
}

export interface DatabaseTitleMetadataEntry {
  imdb_id: string;
  tmdb_id: number | null;
  simkl_id: number | null;
  title: string;
  original_title: string | null;
  media_type: string;
  release_date: string | null;
  genres: string;
  countries: string;
  runtime: number | null;
  overview: string | null;
  poster_url: string | null;
  expires_at: number;
  created_at: number;
}

export interface DatabaseStatsResult {
  total_api_cache_entries: number;
  total_streaming_offers: number;
  total_ratings: number;
  total_metadata: number;
  total_searches: number;
  active_api_cache: number;
  active_offers: number;
  active_ratings: number;
  active_metadata: number;
}

export interface CacheStatsResult {
  [key: string]: {
    total_entries: number;
    active_entries: number;
    expired_entries: number;
    hit_rate?: number;
  };
}

export interface CacheOperationResult {
  success: boolean;
  message: string;
  affected_rows?: number;
}

// Error types
export class ApiError extends Error {
  constructor(
    message: string,
    public source: ApiSource,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
