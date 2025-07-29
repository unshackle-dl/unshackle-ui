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

// WebSocket Message Types (API format)
export interface WebSocketEvent {
  event_type: string;           // "job_status", "job_progress", "test_event", etc.
  job_id?: string;             // Present for job-specific events
  data: Record<string, any>;   // Event payload
  timestamp: number;           // Unix timestamp
}

// Legacy WebSocketMessage for backward compatibility
export interface WebSocketMessage extends WebSocketEvent {
  // Keep old format for compatibility with existing handlers
  type?: 'job_update' | 'job_progress' | 'service_status' | 'ping' | 'pong' | 'system_notification' | 'queue_update' | 'connection_confirmed' | 'initial_status';
}

// Job Status Event Data (sent in WebSocketEvent.data)
export interface JobStatusEventData {
  job_id: string;
  status: string;              // "pending", "running", "completed", "failed"
  progress?: number;           // 0-100
  current_action?: string;
  files_completed?: number;
  files_total?: number;
  current_file?: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

// Job Progress Event Data (sent in WebSocketEvent.data)
export interface JobProgressEventData {
  job_id: string;
  progress: number;            // 0-100
  current_file?: string;
  files_completed?: number;
  files_total?: number;
  downloaded_bytes?: number;
  total_bytes?: number;
  speed?: number;             // bytes per second
}

// Service Status Event Data (sent in WebSocketEvent.data)
export interface ServiceStatusEventData {
  service_id: string;
  status: 'available' | 'unavailable' | 'error';
  auth_status?: 'authenticated' | 'unauthenticated' | 'expired';
  error?: string;
}

// System Notification Event Data (sent in WebSocketEvent.data)
export interface SystemNotificationEventData {
  level: 'info' | 'warning' | 'error';
  message: string;
  details?: string;
  action?: string;
}

// Queue Update Event Data (sent in WebSocketEvent.data)
export interface QueueUpdateEventData {
  status: 'paused' | 'running' | 'stopped';
  active_jobs: number;
  queued_jobs: number;
  total_jobs: number;
}

// Connection Confirmation Event Data (sent upon job WebSocket connection)
export interface ConnectionConfirmedEventData {
  job_id: string;
  message?: string;
  status?: string;               // Initial job status
  progress?: number;             // Initial progress if available
  current_file?: string;         // Current file being processed
  files_total?: number;          // Total files to process
  total_files?: number;          // Alternative naming for total files
}

// Type guards for WebSocket event data
export function isJobStatusEvent(event: WebSocketEvent): event is WebSocketEvent & { data: JobStatusEventData } {
  return event.event_type === 'job_status' && 'job_id' in event.data && 'status' in event.data;
}

export function isJobProgressEvent(event: WebSocketEvent): event is WebSocketEvent & { data: JobProgressEventData } {
  return event.event_type === 'job_progress' && 'job_id' in event.data && 'progress' in event.data;
}

export function isServiceStatusEvent(event: WebSocketEvent): event is WebSocketEvent & { data: ServiceStatusEventData } {
  return event.event_type === 'service_status' && 'service_id' in event.data && 'status' in event.data;
}

export function isSystemNotificationEvent(event: WebSocketEvent): event is WebSocketEvent & { data: SystemNotificationEventData } {
  return event.event_type === 'system_notification' && 'level' in event.data && 'message' in event.data;
}

export function isQueueUpdateEvent(event: WebSocketEvent): event is WebSocketEvent & { data: QueueUpdateEventData } {
  return event.event_type === 'queue_update' && 'status' in event.data && 'active_jobs' in event.data;
}

export function isConnectionConfirmedEvent(event: WebSocketEvent): event is WebSocketEvent & { data: ConnectionConfirmedEventData } {
  return event.event_type === 'connection_confirmed' && 'job_id' in event.data;
}

// UI State Types
export type Theme = 'dark' | 'light' | 'system';
export type TabId = 'search' | 'queue' | 'history' | 'services';

export interface ConnectionStatus {
  unshackle: 'connected' | 'disconnected' | 'error';
  tmdb: 'connected' | 'disconnected' | 'error';
  websocket: 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'error' | 'auth_failed' | 'job_not_found';
}