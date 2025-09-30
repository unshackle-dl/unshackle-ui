/**
 * Unshackle API client for download functionality.
 */

import { API_CONFIG, getApiUrl, getWebSocketUrl } from '@/lib/config/api';

// Request/Response types for the Unshackle API

// Service types
export interface ServiceInfo {
  tag: string;
  aliases: string[];
  geofence: string[];
  title_regex: string | null;
  help: string | null;
}

export interface ServicesResponse {
  services: ServiceInfo[];
}

// Title types
export interface TitleInfo {
  type: 'movie' | 'episode' | 'other';
  name: string;
  series_title?: string;
  season?: number;
  number?: number;
  year?: number;
  id?: string;
}

export interface ListTitlesRequest {
  service: string;
  title_id: string;
  profile?: string;
  proxy?: string;
  no_proxy?: boolean;
}

export interface ListTitlesResponse {
  titles: TitleInfo[];
}

// Track types
export interface VideoTrack {
  id: string;
  codec: string;
  codec_display: string;
  bitrate: number | null;
  width: number | null;
  height: number | null;
  resolution: string | null;
  fps: number | null;
  range: string;
  range_display: string;
  hdr?: string; // Compatibility alias for range_display
  language: string | null;
  drm: string | null;
}

export interface AudioTrack {
  id: string;
  codec: string;
  codec_display: string;
  bitrate: number | null;
  channels: number | null;
  language: string | null;
  atmos: boolean;
  descriptive: boolean;
  drm: string | null;
}

export interface SubtitleTrack {
  id: string;
  codec: string;
  format?: string; // Compatibility alias for codec
  language: string | null;
  forced: boolean;
  sdh: boolean;
  cc: boolean;
}

export interface EpisodeTracksInfo {
  title: TitleInfo;
  video: VideoTrack[];
  audio: AudioTrack[];
  subtitles: SubtitleTrack[];
}

export interface ListTracksRequest {
  service: string;
  title_id: string;
  wanted?: string; // e.g., "1x1,1x2,2x1-2x5"
  season?: number;
  episode?: number;
  profile?: string;
  proxy?: string;
  no_proxy?: boolean;
}

export interface ListTracksResponse {
  // Single title (movie or single episode)
  title?: TitleInfo;
  video?: VideoTrack[];
  audio?: AudioTrack[];
  subtitles?: SubtitleTrack[];
  // Multiple episodes
  episodes?: EpisodeTracksInfo[];
  unavailable_episodes?: string[];
}

// Download types
export interface DownloadRequest {
  service: string;
  url: string;
  quality?: string;
  range?: string;
  v_lang?: string;
  a_lang?: string;
  s_lang?: string;
  tmdb_id?: string;
  proxy?: string;
  wanted?: string; // For episodes: "1x1,1x2,2x1-2x5"
  profile?: string;
}

export interface DownloadResponse {
  job_id: string;
  status: string;
  created_time: string;
}

export interface DownloadJob {
  job_id: string;
  service: string;
  title_id: string;
  title?: string; // Compatibility field - may not be in API response
  status: string;
  created_time: string;
  progress?: number;
  current_track?: string;
  speed?: string;
  downloaded?: string;
  total?: string;
  position?: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

export interface DownloadJobsResponse {
  jobs: DownloadJob[];
}

// Compatibility aliases for existing code
export type ServiceMatch = any; // Deprecated - no longer used
export type TrackInfo = VideoTrack | AudioTrack | SubtitleTrack;
export interface EpisodeInfo {
  season: number;
  episode: number;
  title?: string;
  video_tracks: VideoTrack[];
  audio_tracks: AudioTrack[];
  subtitle_tracks: SubtitleTrack[];
}
export interface TrackListingResponse extends ListTracksResponse {
  episodes?: EpisodeInfo[];
}
export interface DownloadQueueResponse {
  active: DownloadJob | null;
  queued: DownloadJob[];
  completed: DownloadJob[];
}

// Deprecated types for settings/config pages (no longer supported by API)
export interface APIConfig {
  [key: string]: any;
}
export interface ServiceCredentials {
  username?: string;
  password?: string;
  email?: string;
  has_cookies?: boolean;
  cookie_file?: string;
}
export interface CredentialUpdateRequest {
  service: string;
  username?: string;
  password?: string;
}

export interface WebSocketMessage {
  type: 'progress' | 'job_status' | 'error' | 'subscribed' | 'unsubscribed' | 'pong';
  job_id?: string;
  status?: string;
  timestamp?: string;
  data?: any;
  error_code?: string;
  message?: string;
}

/**
 * API client error class.
 */
export class UnshackleApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'UnshackleApiError';
  }
}

/**
 * Main API client class.
 */
export class UnshackleApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = getApiUrl();
    this.timeout = API_CONFIG.timeout;
  }

  /**
   * Make an HTTP request to the API.
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    customTimeout?: number
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[UnshackleApiClient] Making ${method} request to:`, url);
    console.log(`[UnshackleApiClient] Request data:`, data);

    const controller = new AbortController();
    const timeoutMs = customTimeout ?? this.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      // Add API key authentication if configured
      if (API_CONFIG.apiKey) {
        headers['X-API-Key'] = API_CONFIG.apiKey;
      }

      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`[UnshackleApiClient] Response status:`, response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorCode = 'HTTP_ERROR';
        let recoverable = false;

        try {
          const errorData = await response.json();
          console.log(`[UnshackleApiClient] Error response:`, errorData);
          if (errorData.error) {
            errorMessage = errorData.error.message || errorMessage;
            errorCode = errorData.error.code || errorCode;
            recoverable = errorData.error.recoverable || false;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // If we can't parse the error response, use the default message
        }

        throw new UnshackleApiError(errorMessage, response.status, errorCode, recoverable);
      }

      const result = await response.json();
      console.log(`[UnshackleApiClient] Response data:`, result);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`[UnshackleApiClient] Request failed:`, error);

      if (error instanceof UnshackleApiError) {
        throw error;
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new UnshackleApiError('Request timeout', 408, 'TIMEOUT');
      }

      throw new UnshackleApiError(
        error instanceof Error ? error.message : 'Unknown error',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * List all available Unshackle services.
   */
  async getServices(): Promise<ServicesResponse> {
    return this.request<ServicesResponse>('GET', '/services');
  }

  /**
   * List titles for a service and title ID.
   */
  async listTitles(request: ListTitlesRequest): Promise<ListTitlesResponse> {
    return this.request<ListTitlesResponse>('POST', '/list-titles', request);
  }

  /**
   * List available tracks for content.
   * Note: This operation can take 2-5 minutes for some services.
   */
  async listTracks(request: ListTracksRequest): Promise<ListTracksResponse> {
    // Use the default 5-minute timeout (already configured in API_CONFIG)
    return this.request<ListTracksResponse>('POST', '/list-tracks', request);
  }

  /**
   * Start a new download job.
   */
  async startDownload(request: DownloadRequest): Promise<DownloadResponse> {
    return this.request<DownloadResponse>('POST', '/download', request);
  }

  /**
   * Get all download jobs.
   */
  async getDownloadJobs(): Promise<DownloadJobsResponse> {
    return this.request<DownloadJobsResponse>('GET', '/download/jobs');
  }

  /**
   * Get the current download queue status (compatibility wrapper).
   */
  async getDownloadQueue(): Promise<DownloadQueueResponse> {
    const response = await this.getDownloadJobs();
    // TODO: The new API doesn't separate active/queued/completed
    // For now, return a compatible structure
    return {
      active: response.jobs.find(j => j.status === 'downloading') || null,
      queued: response.jobs.filter(j => j.status === 'queued'),
      completed: response.jobs.filter(j => ['completed', 'failed', 'cancelled'].includes(j.status)),
    };
  }

  /**
   * Get status of a specific download job.
   */
  async getJobStatus(jobId: string): Promise<DownloadJob> {
    return this.request<DownloadJob>('GET', `/download/jobs/${jobId}`);
  }

  /**
   * Cancel a download job.
   */
  async cancelJob(jobId: string): Promise<{ message: string; status: string }> {
    return this.request<{ message: string; status: string }>('DELETE', `/download/jobs/${jobId}`);
  }

  /**
   * Clear all completed and failed jobs from history (not supported by new API).
   */
  async clearCompletedJobs(): Promise<{ message: string }> {
    // The new API doesn't have this endpoint yet
    throw new UnshackleApiError(
      'clearCompletedJobs is not supported by the current API',
      501,
      'NOT_IMPLEMENTED'
    );
  }

  /**
   * Deprecated: Check which Unshackle services support the provided streaming URLs.
   * This functionality should now be handled by matching service regex patterns.
   */
  async checkAvailability(urls: string[]): Promise<any> {
    throw new UnshackleApiError(
      'checkAvailability is deprecated - use getServices() and match URLs manually',
      501,
      'DEPRECATED'
    );
  }

  /**
   * Check if the API is healthy and accessible.
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    return this.request<{ status: string; version: string }>('GET', '/health');
  }
}

/**
 * WebSocket client for real-time download progress updates.
 */
export class UnshackleWebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, ((message: WebSocketMessage) => void)[]> = new Map();
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(private url: string = getWebSocketUrl('/ws/downloads')) {}

  /**
   * Connect to the WebSocket server.
   */
  connect(): Promise<void> {
    // Return existing connection promise if already connecting
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    // Return resolved promise if already connected
    if (this.isConnected) {
      return Promise.resolve();
    }

    this.isConnecting = true;
    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[UnshackleWS] Connected to WebSocket');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          this.connectionPromise = null;
          resolve();
        };

        this.ws.onmessage = event => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[UnshackleWS] Failed to parse message:', error);
          }
        };

        this.ws.onclose = event => {
          console.log(`[UnshackleWS] Connection closed: ${event.code} ${event.reason}`);
          this.ws = null;
          this.isConnecting = false;
          this.connectionPromise = null;

          if (
            !event.wasClean &&
            this.reconnectAttempts < API_CONFIG.websocket.maxReconnectAttempts
          ) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = error => {
          console.error('[UnshackleWS] WebSocket error:', error);
          this.isConnecting = false;
          this.connectionPromise = null;
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        };
      } catch (error) {
        this.isConnecting = false;
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.isConnecting = false;
    this.connectionPromise = null;
  }

  /**
   * Subscribe to progress updates for a specific job.
   */
  subscribeToJob(jobId: string): void {
    this.send({
      type: 'subscribe',
      job_id: jobId,
    });
  }

  /**
   * Unsubscribe from progress updates for a specific job.
   */
  unsubscribeFromJob(jobId: string): void {
    this.send({
      type: 'unsubscribe',
      job_id: jobId,
    });
  }

  /**
   * Send a ping message to keep the connection alive.
   */
  ping(): void {
    this.send({ type: 'ping' });
  }

  /**
   * Add an event listener for specific message types.
   */
  addEventListener(type: string, listener: (message: WebSocketMessage) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  /**
   * Remove an event listener.
   */
  removeEventListener(type: string, listener: (message: WebSocketMessage) => void): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      const index = typeListeners.indexOf(listener);
      if (index > -1) {
        typeListeners.splice(index, 1);
      }
    }
  }

  /**
   * Send a message through the WebSocket.
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[UnshackleWS] Cannot send message - WebSocket not connected');
    }
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private handleMessage(message: WebSocketMessage): void {
    // Notify type-specific listeners
    const typeListeners = this.listeners.get(message.type);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        try {
          listener(message);
        } catch (error) {
          console.error(`[UnshackleWS] Listener error for ${message.type}:`, error);
        }
      });
    }

    // Notify global listeners
    const globalListeners = this.listeners.get('*');
    if (globalListeners) {
      globalListeners.forEach(listener => {
        try {
          listener(message);
        } catch (error) {
          console.error('[UnshackleWS] Global listener error:', error);
        }
      });
    }
  }

  /**
   * Schedule a reconnection attempt.
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    console.log(
      `[UnshackleWS] Scheduling reconnect attempt ${this.reconnectAttempts}/${API_CONFIG.websocket.maxReconnectAttempts}`
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('[UnshackleWS] Reconnect failed:', error);
      });
    }, API_CONFIG.websocket.reconnectInterval);
  }

  /**
   * Get the current connection status.
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instances
export const unshackleApi = new UnshackleApiClient();
export const unshackleWebSocket = new UnshackleWebSocketClient();
