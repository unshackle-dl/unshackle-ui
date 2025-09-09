import type { 
  APIResponse, 
  SearchRequest, 
  SearchResult, 
  DownloadRequest, 
  DownloadJob, 
  ServiceInfo, 
  ServiceConfig, 
  ServiceAuthRequest, 
  ServiceConfigRequest, 
  WebSocketMessage 
} from '../types';
import { APIError, APIErrorType } from './api-errors';

export class UnshackleAPIClient {
  private baseURL: string;
  private apiKey: string;
  private wsConnection: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(baseURL: string = 'http://localhost:8888', apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
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

  // Search for content
  async search(params: SearchRequest): Promise<SearchResult[]> {
    const response = await this.request<SearchResult[]>('/api/v1/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Search failed');
    }

    return response.data || [];
  }

  // Start a download
  async startDownload(params: DownloadRequest): Promise<string> {
    const response = await this.request<{ job_id: string }>('/api/v1/downloads/start', {
      method: 'POST',
      body: JSON.stringify(params),
    });

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Download failed to start');
    }

    return response.data?.job_id || '';
  }

  // Get job status
  async getJobStatus(jobId: string): Promise<DownloadJob> {
    const response = await this.request<DownloadJob>(`/api/v1/downloads/jobs/${jobId}`);

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Failed to get job status');
    }

    if (!response.data) {
      throw new Error('No job data received');
    }

    return response.data;
  }

  // Get all jobs
  async getAllJobs(): Promise<DownloadJob[]> {
    const response = await this.request<DownloadJob[]>('/api/v1/downloads/queue');

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Failed to get jobs');
    }

    return response.data || [];
  }

  // Cancel a job
  async cancelJob(jobId: string): Promise<void> {
    const response = await this.request(`/api/v1/downloads/jobs/${jobId}/cancel`, {
      method: 'POST',
    });

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Failed to cancel job');
    }
  }

  // Get available services
  async getServices(): Promise<ServiceInfo[]> {
    const response = await this.request<ServiceInfo[]>('/api/v1/availability/services');

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Failed to get services');
    }

    return response.data || [];
  }


  // Test service connection
  async testService(serviceId: string): Promise<boolean> {
    const response = await this.request<{ success: boolean }>(`/api/v1/services/${serviceId}/test`, {
      method: 'POST',
    });

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Service test failed');
    }

    return response.data?.success || false;
  }

  // Authenticate with service
  async authenticateService(params: ServiceAuthRequest): Promise<void> {
    const response = await this.request(`/api/v1/services/${params.service_id}/auth`, {
      method: 'POST',
      body: JSON.stringify({ credentials: params.credentials }),
    });

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Authentication failed');
    }
  }

  // Logout from service
  async logoutService(serviceId: string): Promise<void> {
    const response = await this.request(`/api/v1/services/${serviceId}/auth`, {
      method: 'DELETE',
    });

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Logout failed');
    }
  }

  // Get service configuration
  async getServiceConfig(serviceId: string): Promise<ServiceConfig> {
    const response = await this.request<ServiceConfig>(`/api/v1/services/${serviceId}/config`);

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Failed to get service config');
    }

    if (!response.data) {
      throw new Error('No config data received');
    }

    return response.data;
  }

  // Update service configuration
  async updateServiceConfig(params: ServiceConfigRequest): Promise<void> {
    const response = await this.request(`/api/v1/services/${params.service_id}/config`, {
      method: 'PUT',
      body: JSON.stringify(params.config),
    });

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Failed to update service config');
    }
  }

  // Enable/disable service
  async toggleService(serviceId: string, enabled: boolean): Promise<void> {
    const response = await this.request(`/api/v1/services/${serviceId}/${enabled ? 'enable' : 'disable'}`, {
      method: 'POST',
    });

    if (response.status === 'error') {
      throw new Error(response.error?.message || `Failed to ${enabled ? 'enable' : 'disable'} service`);
    }
  }

  // WebSocket connection for job-specific events
  connectToJobEvents(
    jobId: string, 
    onMessage?: (message: WebSocketMessage) => void,
    onOpen?: () => void,
    onClose?: () => void,
    onAuthError?: () => void,
    onJobNotFound?: () => void,
    onError?: (error: Event) => void
  ): void {
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already open for job events, skipping connection');
      onOpen?.(); // Call onOpen since we're already connected
      return;
    }
    
    if (this.wsConnection?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connecting for job events, skipping');
      return;
    }

    const wsURL = this.baseURL.replace(/^http/, 'ws') + `/api/v1/downloads/jobs/${jobId}/events?token=devwork`;
    this.wsConnection = new WebSocket(wsURL);

    this.wsConnection.onopen = () => {
      console.log(`WebSocket connected to Unshackle job ${jobId}`);
      this.reconnectAttempts = 0;
      onOpen?.();
    };

    this.wsConnection.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        onMessage?.(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.wsConnection.onclose = (event) => {
      console.log(`WebSocket disconnected from Unshackle job ${jobId} with code: ${event.code}`);
      onClose?.();
      
      // Handle authentication errors specifically
      if (event.code === 4001) {
        console.error('Authentication failed for job WebSocket connection');
        onAuthError?.();
        // Don't auto-reconnect on auth failure
        return;
      }
      
      // Handle job not found errors
      if (event.code === 4004) {
        console.error('Job not found for WebSocket connection');
        onJobNotFound?.();
        // Don't auto-reconnect for non-existent jobs
        return;
      }
      
      this.handleReconnect(jobId, onMessage, onOpen, onClose, onAuthError, onJobNotFound, onError);
    };

    this.wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };
  }

  // WebSocket connection for global events
  connectToGlobalEvents(
    onMessage?: (message: WebSocketMessage) => void,
    onOpen?: () => void,
    onClose?: () => void,
    onAuthError?: () => void,
    onError?: (error: Event) => void
  ): void {
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already open for global events, skipping connection');
      onOpen?.(); // Call onOpen since we're already connected
      return;
    }
    
    if (this.wsConnection?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connecting for global events, skipping');
      return;
    }

    const wsURL = this.baseURL.replace(/^http/, 'ws') + `/api/v1/events?token=devwork`;
    this.wsConnection = new WebSocket(wsURL);

    this.wsConnection.onopen = () => {
      console.log('WebSocket connected to Unshackle global events');
      this.reconnectAttempts = 0;
      onOpen?.();
    };

    this.wsConnection.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        onMessage?.(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.wsConnection.onclose = (event) => {
      console.log(`WebSocket disconnected from Unshackle global events with code: ${event.code}`);
      onClose?.();
      
      // Handle authentication errors specifically
      if (event.code === 4001) {
        console.error('Authentication failed for global WebSocket connection');
        onAuthError?.();
        // Don't auto-reconnect on auth failure
        return;
      }
      
      this.handleGlobalReconnect(onMessage, onOpen, onClose, onAuthError, onError);
    };

    this.wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError?.(error);
    };
  }

  // Backward compatibility: WebSocket connection for general use (defaults to global events)
  connectWebSocket(onMessage?: (message: WebSocketMessage) => void): void {
    this.connectToGlobalEvents(onMessage);
  }

  private handleReconnect(
    jobId: string, 
    onMessage?: (message: WebSocketMessage) => void,
    onOpen?: () => void,
    onClose?: () => void,
    onAuthError?: () => void,
    onJobNotFound?: () => void,
    onError?: (error: Event) => void
  ): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`Reconnecting job WebSocket (attempt ${this.reconnectAttempts})`);
        this.connectToJobEvents(jobId, onMessage, onOpen, onClose, onAuthError, onJobNotFound, onError);
      }, Math.pow(2, this.reconnectAttempts) * 1000); // Exponential backoff
    }
  }

  private handleGlobalReconnect(
    onMessage?: (message: WebSocketMessage) => void,
    onOpen?: () => void,
    onClose?: () => void,
    onAuthError?: () => void,
    onError?: (error: Event) => void
  ): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`Reconnecting global WebSocket (attempt ${this.reconnectAttempts})`);
        this.connectToGlobalEvents(onMessage, onOpen, onClose, onAuthError, onError);
      }, Math.pow(2, this.reconnectAttempts) * 1000); // Exponential backoff
    }
  }

  disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  // Retry logic for failed requests
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries && this.isRetryableError(error)) {
          await this.delay(delay * Math.pow(2, attempt)); // Exponential backoff
          continue;
        }

        throw error;
      }
    }

    throw lastError!;
  }

  private isRetryableError(error: unknown): boolean {
    // Network errors, timeouts, and 5xx status codes are retryable
    if (typeof error === 'object' && error !== null) {
      const err = error as { name?: string; code?: string; status?: number };
      return (
        err.name === 'NetworkError' ||
        err.code === 'ECONNRESET' ||
        (typeof err.status === 'number' && err.status >= 500 && err.status < 600)
      );
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}