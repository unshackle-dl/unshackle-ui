/**
 * Unshackle API client for download functionality.
 */

import { API_CONFIG, getApiUrl, getWebSocketUrl } from '@/lib/config/api';

// Request/Response types for the Unshackle API
export interface ServiceAvailabilityRequest {
  streaming_urls: string[];
}

export interface ServiceMatch {
  url: string;
  service: string | null;
  supported: boolean;
  content_id: string | null;
  content_type: string | null;
  requires_auth: boolean;
  match_method: string | null;
}

export interface ServiceAvailabilityResponse {
  matches: ServiceMatch[];
}

export interface TrackListingRequest {
  service: string;
  url: string;
  selection?: {
    type: 'all' | 'season' | 'episode';
    season?: number;
    episode?: number;
  };
  profile?: string;
  proxy?: string;
}

export interface TrackInfo {
  id: string;
  type: string;
  language?: string;
  codec?: string;
  resolution?: string;
  bitrate?: string;
  channels?: string;
  format?: string;
  fps?: number;
  hdr?: string;
}

export interface EpisodeInfo {
  season: number;
  episode: number;
  title?: string;
  video_tracks: TrackInfo[];
  audio_tracks: TrackInfo[];
  subtitle_tracks: TrackInfo[];
}

export interface TrackListingResponse {
  cache_id: string;
  episodes: EpisodeInfo[];
  cached_at?: string;
  expires_at?: string;
}

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
  episodes?: {
    mode: 'all' | 'season' | 'specific';
    season?: number;
    list?: number[];
  };
  profile?: string;
}

export interface DownloadResponse {
  job_id: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  command: string;
  queue_position?: number;
}

export interface DownloadJob {
  job_id: string;
  service: string;
  title: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'cancelled';
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

export interface DownloadQueueResponse {
  active: DownloadJob | null;
  queued: DownloadJob[];
  completed: DownloadJob[];
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

// Configuration types
export interface APIConfig {
  host: string;
  port: number;
  workers: number;
  download_path: string;
  max_concurrent_downloads: number;
  download_queue_size: number;
  websocket: {
    ping_interval: number;
    max_connections: number;
    reconnect_attempts: number;
  };
  cache: {
    track_list_ttl: number;
    service_check_ttl: number;
    api_response_ttl: number;
    database_path: string;
  };
  cors: {
    enabled: boolean;
    origins: string[];
  };
  logging: {
    level: string;
    file: string;
    max_size: number;
    backup_count: number;
  };
}

export interface ConfigResponse {
  api: APIConfig;
  services: {
    available: string[];
    configured: string[];
  };
  profiles: string[];
}

export interface ConfigUpdateRequest {
  api?: Partial<APIConfig>;
}

export interface ConfigUpdateResponse {
  message: string;
  updated_fields: string[];
}

// Profile and credential types
export interface ServiceCredentials {
  username?: string;
  password?: string;
  email?: string;
  has_cookies: boolean;
  cookie_file?: string;
}

export interface ProfileInfo {
  name: string;
  is_active: boolean;
  services: Record<string, ServiceCredentials>;
}

export interface ProfileListResponse {
  profiles: ProfileInfo[];
}

export interface CredentialUpdateRequest {
  service: string;
  username?: string;
  password?: string;
}

export interface CredentialUpdateResponse {
  message: string;
  service: string;
  profile: string;
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
    data?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[UnshackleApiClient] Making ${method} request to:`, url);
    console.log(`[UnshackleApiClient] Request data:`, data);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
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
   * Check which Unshackle services support the provided streaming URLs.
   */
  async checkAvailability(urls: string[]): Promise<ServiceAvailabilityResponse> {
    console.log('[UnshackleApiClient] checkAvailability called with URLs:', urls);
    console.log('[UnshackleApiClient] Base URL:', this.baseUrl);
    
    const result = await this.request<ServiceAvailabilityResponse>('POST', '/availability/check', {
      streaming_urls: urls,
    });
    
    console.log('[UnshackleApiClient] checkAvailability result:', result);
    return result;
  }

  /**
   * List all available Unshackle services.
   */
  async listServices(): Promise<{ services: any[] }> {
    return this.request<{ services: any[] }>('GET', '/availability/services');
  }

  /**
   * Get detailed information about a specific service.
   */
  async getServiceInfo(serviceTag: string): Promise<any> {
    return this.request<any>('GET', `/availability/services/${serviceTag}`);
  }

  /**
   * List available tracks for content.
   */
  async listTracks(request: TrackListingRequest): Promise<TrackListingResponse> {
    return this.request<TrackListingResponse>('POST', '/tracks/list', request);
  }

  /**
   * Get track listing cache statistics.
   */
  async getTrackCacheStats(): Promise<{ total_entries: number; valid_entries: number; expired_entries: number }> {
    return this.request('GET', '/tracks/cache/stats');
  }

  /**
   * Clear the track listing cache.
   */
  async clearTrackCache(): Promise<{ message: string }> {
    return this.request('DELETE', '/tracks/cache/clear');
  }

  /**
   * Start a new download job.
   */
  async startDownload(request: DownloadRequest): Promise<DownloadResponse> {
    return this.request<DownloadResponse>('POST', '/downloads/start', request);
  }

  /**
   * Get the current download queue status.
   */
  async getDownloadQueue(): Promise<DownloadQueueResponse> {
    return this.request<DownloadQueueResponse>('GET', '/downloads/queue');
  }

  /**
   * Get status of a specific download job.
   */
  async getJobStatus(jobId: string): Promise<DownloadJob> {
    return this.request<DownloadJob>('GET', `/downloads/jobs/${jobId}`);
  }

  /**
   * Cancel a download job.
   */
  async cancelJob(jobId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('POST', `/downloads/jobs/${jobId}/cancel`);
  }

  /**
   * Clear all completed and failed jobs from history.
   */
  async clearCompletedJobs(): Promise<{ message: string }> {
    return this.request<{ message: string }>('DELETE', '/downloads/jobs/completed');
  }

  /**
   * Check if the API is healthy and accessible.
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    // Health endpoint is at root level, not under /api/v1
    const url = this.baseUrl.replace('/api/v1', '') + '/health';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new UnshackleApiError(`Health check failed: ${response.statusText}`, response.status);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof UnshackleApiError) {
        throw error;
      }
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new UnshackleApiError('Health check timeout', 408, 'TIMEOUT');
      }
      
      throw new UnshackleApiError(
        error instanceof Error ? error.message : 'Health check failed',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  // Configuration Management

  /**
   * Get current configuration.
   */
  async getConfig(): Promise<ConfigResponse> {
    return this.request<ConfigResponse>('GET', '/config');
  }

  /**
   * Update configuration settings.
   */
  async updateConfig(config: ConfigUpdateRequest): Promise<ConfigUpdateResponse> {
    return this.request<ConfigUpdateResponse>('PUT', '/config', config);
  }

  /**
   * Get configuration schema for validation.
   */
  async getConfigSchema(): Promise<Record<string, any>> {
    return this.request<Record<string, any>>('GET', '/config/schema');
  }

  // Profile Management

  /**
   * List all available profiles.
   */
  async getProfiles(): Promise<ProfileListResponse> {
    return this.request<ProfileListResponse>('GET', '/profiles');
  }

  /**
   * Activate a specific profile.
   */
  async activateProfile(profileName: string): Promise<{ message: string; profile: string }> {
    return this.request<{ message: string; profile: string }>('POST', `/profiles/${profileName}/activate`);
  }

  /**
   * Update credentials for a service in a profile.
   */
  async updateCredentials(
    profileName: string, 
    credentials: CredentialUpdateRequest
  ): Promise<CredentialUpdateResponse> {
    return this.request<CredentialUpdateResponse>('PUT', `/profiles/${profileName}/credentials`, credentials);
  }

  /**
   * Get credentials for a specific service.
   */
  async getServiceCredentials(profileName: string, service: string): Promise<{
    service: string;
    profile: string;
    has_username: boolean;
    has_password: boolean;
    has_cookies: boolean;
    username?: string;
  }> {
    return this.request('GET', `/profiles/${profileName}/credentials/${service}`);
  }

  /**
   * Remove credentials for a specific service.
   */
  async removeServiceCredentials(profileName: string, service: string): Promise<{
    message: string;
    service: string;
    profile: string;
  }> {
    return this.request('DELETE', `/profiles/${profileName}/credentials/${service}`);
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

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[UnshackleWS] Failed to parse message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log(`[UnshackleWS] Connection closed: ${event.code} ${event.reason}`);
          this.ws = null;
          this.isConnecting = false;
          this.connectionPromise = null;
          
          if (!event.wasClean && this.reconnectAttempts < API_CONFIG.websocket.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
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
    console.log(`[UnshackleWS] Scheduling reconnect attempt ${this.reconnectAttempts}/${API_CONFIG.websocket.maxReconnectAttempts}`);

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