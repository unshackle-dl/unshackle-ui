// Base API Response Interface
export interface APIResponse<T = any> {
  status: 'success' | 'error';
  timestamp: string;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Unshackle API Types
export interface SearchRequest {
  service: string;
  query: string;
  type?: 'movie' | 'tv' | 'music';
}

export interface SearchResult {
  id: string;
  title: string;
  type: 'movie' | 'tv' | 'music';
  year?: number;
  description?: string;
  service: string;
}

export interface DownloadRequest {
  service: string;
  content_id: string;
  quality?: '720p' | '1080p' | '4k';
  output_path?: string;
  hdr10?: boolean;
  dolby_vision?: boolean;
  atmos?: boolean;
  subtitles?: boolean;
  audio_tracks?: string[];
}

export interface DownloadJob {
  id: string;
  service: string;
  content_id: string;
  content_title: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed';
  progress?: number;
  current_file?: string;
  total_files?: number;
  downloaded_bytes?: number;
  total_bytes?: number;
  error?: string;
  start_time: string;
  end_time?: string;
}

export interface ServiceInfo {
  id: string;
  name: string;
  status: 'available';  // If API reports it, it's available
  description?: string;
  requires_auth: boolean;
  auth_status?: 'authenticated' | 'unauthenticated' | 'expired';
  config?: ServiceConfig;
}

export interface ServiceConfig {
  enabled: boolean;
  auto_retry: boolean;
  max_concurrent_downloads: number;
  timeout: number;
  custom_settings?: Record<string, any>;
}

export interface ServiceAuthRequest {
  service_id: string;
  credentials?: Record<string, string>;
}

export interface ServiceConfigRequest {
  service_id: string;
  config: Partial<ServiceConfig>;
}

// TMDB API Types
export interface TMDBSearchResult {
  id: number;
  media_type: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  adult: boolean;
  original_language: string;
  popularity: number;
}

export interface TMDBMovieDetails {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date: string;
  runtime: number;
  vote_average: number;
  vote_count: number;
  genres: Array<{ id: number; name: string }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages: Array<{ iso_639_1: string; name: string }>;
  imdb_id: string;
  tagline: string;
  budget: number;
  revenue: number;
  status: string;
}

export interface TMDBTVDetails {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  first_air_date: string;
  last_air_date: string;
  number_of_episodes: number;
  number_of_seasons: number;
  episode_run_time: number[];
  vote_average: number;
  vote_count: number;
  genres: Array<{ id: number; name: string }>;
  networks: Array<{ id: number; name: string; logo_path: string }>;
  seasons: Array<{
    id: number;
    season_number: number;
    episode_count: number;
    air_date: string;
    poster_path: string;
  }>;
  status: string;
  type: string;
}

// Enhanced Search Result (combining Unshackle + TMDB)
export interface EnhancedSearchResult {
  unshackleResult: SearchResult;
  tmdbData?: TMDBSearchResult;
  tmdbDetails?: TMDBMovieDetails | TMDBTVDetails;
  displayTitle: string;
  displayYear: string;
  posterURL?: string;
  backdropURL?: string;
  description?: string;
  rating?: number;
  genres?: string[];
}

// Download Options
export interface DownloadOptions {
  quality: '720p' | '1080p' | '4k';
  hdr10: boolean;
  dolby_vision: boolean;
  atmos: boolean;
  subtitles: boolean;
  audio_tracks: string[];
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'job_update' | 'job_progress' | 'service_status' | 'ping' | 'pong' | 'system_notification' | 'queue_update';
  data?: any;
  timestamp?: number;
}

// UI State Types
export type Theme = 'dark' | 'light' | 'system';
export type TabId = 'search' | 'queue' | 'history' | 'services';

export interface ConnectionStatus {
  unshackle: 'connected' | 'disconnected' | 'error';
  tmdb: 'connected' | 'disconnected' | 'error';
  websocket: 'connected' | 'disconnected' | 'error';
}