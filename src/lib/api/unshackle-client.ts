import { type APIResponse, type SearchRequest, type SearchResult, type DownloadRequest, type DownloadJob, type ServiceInfo, type WebSocketMessage } from '../types';

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
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Search for content
  async search(params: SearchRequest): Promise<SearchResult[]> {
    const response = await this.request<SearchResult[]>('/api/search', {
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
    const response = await this.request<{ job_id: string }>('/api/download', {
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
    const response = await this.request<DownloadJob>(`/api/status/${jobId}`);

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
    const response = await this.request<DownloadJob[]>('/api/jobs');

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Failed to get jobs');
    }

    return response.data || [];
  }

  // Cancel a job
  async cancelJob(jobId: string): Promise<void> {
    const response = await this.request(`/api/jobs/${jobId}`, {
      method: 'DELETE',
    });

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Failed to cancel job');
    }
  }

  // Get available services
  async getServices(): Promise<ServiceInfo[]> {
    const response = await this.request<ServiceInfo[]>('/api/services');

    if (response.status === 'error') {
      throw new Error(response.error?.message || 'Failed to get services');
    }

    return response.data || [];
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage?: (message: WebSocketMessage) => void): void {
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const wsURL = this.baseURL.replace(/^http/, 'ws') + '/ws';
    this.wsConnection = new WebSocket(wsURL);

    this.wsConnection.onopen = () => {
      console.log('WebSocket connected to Unshackle');
      this.reconnectAttempts = 0;
    };

    this.wsConnection.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        onMessage?.(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.wsConnection.onclose = () => {
      console.log('WebSocket disconnected from Unshackle');
      this.handleReconnect(onMessage);
    };

    this.wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private handleReconnect(onMessage?: (message: WebSocketMessage) => void): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`Reconnecting WebSocket (attempt ${this.reconnectAttempts})`);
        this.connectWebSocket(onMessage);
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

  private isRetryableError(error: any): boolean {
    // Network errors, timeouts, and 5xx status codes are retryable
    return (
      error.name === 'NetworkError' ||
      error.code === 'ECONNRESET' ||
      (error.status >= 500 && error.status < 600)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}