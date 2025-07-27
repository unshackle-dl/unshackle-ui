import { UnshackleAPIClient } from './unshackle-client';
import { TMDBClient } from './tmdb-client';
import { getAPIConfig, validateAPIConfig, type APIConfig } from './api-config';
import { APIError, APIErrorType } from './api-errors';
import { useUIStore } from '@/stores/ui-store';

export interface ConnectionStatus {
  unshackle: 'connected' | 'disconnected' | 'error' | 'checking';
  tmdb: 'connected' | 'disconnected' | 'error' | 'checking';
}

export class APIClientManager {
  private config: APIConfig;
  private unshackleClient: UnshackleAPIClient | null = null;
  private tmdbClient: TMDBClient | null = null;
  private connectionStatus: ConnectionStatus = {
    unshackle: 'disconnected',
    tmdb: 'disconnected',
  };
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.config = getAPIConfig();
    this.validateConfiguration();
  }

  private validateConfiguration() {
    const validation = validateAPIConfig(this.config);
    
    if (!validation.isValid) {
      console.error('API Configuration validation failed:', validation.errors);
      // Don't throw here, just log. UI should handle missing config gracefully
    }
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Unshackle client
      if (this.config.unshackle.apiKey) {
        this.unshackleClient = new UnshackleAPIClient(
          this.config.unshackle.baseURL,
          this.config.unshackle.apiKey
        );
        await this.testUnshackleConnection();
      }

      // Initialize TMDB client
      if (this.config.tmdb.apiKey) {
        this.tmdbClient = new TMDBClient(this.config.tmdb.apiKey);
        await this.testTMDBConnection();
      }

      // Start health checks
      this.startHealthChecks();

      console.log('API clients initialized successfully');
    } catch (error) {
      console.error('Failed to initialize API clients:', error);
      throw error;
    }
  }

  private async testUnshackleConnection(): Promise<void> {
    if (!this.unshackleClient) return;

    this.setConnectionStatus('unshackle', 'checking');

    try {
      // Test connection by fetching services
      await this.unshackleClient.getServices();
      this.setConnectionStatus('unshackle', 'connected');
    } catch (error) {
      console.error('Unshackle connection test failed:', error);
      this.setConnectionStatus('unshackle', 'error');
      
      if (error instanceof APIError && error.type === APIErrorType.AUTHENTICATION_ERROR) {
        this.notifyUser('Authentication failed. Please check your Unshackle API key.', 'error');
      }
    }
  }

  private async testTMDBConnection(): Promise<void> {
    if (!this.tmdbClient) return;

    this.setConnectionStatus('tmdb', 'checking');

    try {
      // Test connection with a simple search
      await this.tmdbClient.searchMulti('test', 1);
      this.setConnectionStatus('tmdb', 'connected');
    } catch (error) {
      console.error('TMDB connection test failed:', error);
      this.setConnectionStatus('tmdb', 'error');
      
      if (error instanceof APIError && error.type === APIErrorType.AUTHENTICATION_ERROR) {
        this.notifyUser('TMDB authentication failed. Please check your TMDB API key.', 'error');
      }
    }
  }

  private setConnectionStatus(service: keyof ConnectionStatus, status: ConnectionStatus[keyof ConnectionStatus]) {
    this.connectionStatus[service] = status;
    
    // Update UI store
    useUIStore.getState().setConnectionStatus({
      [service]: status
    });
  }

  private notifyUser(message: string, type: 'success' | 'error' | 'warning' | 'info') {
    useUIStore.getState().addNotification({
      type,
      title: 'API Connection',
      description: message,
    });
  }

  private startHealthChecks(): void {
    // Check connection health every 5 minutes
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 5 * 60 * 1000);
  }

  private async performHealthChecks(): Promise<void> {
    if (this.unshackleClient && this.connectionStatus.unshackle === 'connected') {
      try {
        await this.unshackleClient.getServices();
      } catch (error) {
        console.warn('Unshackle health check failed:', error);
        this.setConnectionStatus('unshackle', 'error');
      }
    }

    // TMDB doesn't need frequent health checks due to rate limits
    // We'll only check if there was a previous error
    if (this.tmdbClient && this.connectionStatus.tmdb === 'error') {
      try {
        await this.tmdbClient.searchMulti('test', 1);
        this.setConnectionStatus('tmdb', 'connected');
      } catch (error) {
        console.warn('TMDB health check failed:', error);
      }
    }
  }

  // Public API
  getUnshackleClient(): UnshackleAPIClient {
    if (!this.unshackleClient) {
      throw new APIError(
        APIErrorType.UNKNOWN_ERROR,
        'Unshackle client is not initialized. Please check your configuration.'
      );
    }
    return this.unshackleClient;
  }

  getTMDBClient(): TMDBClient {
    if (!this.tmdbClient) {
      throw new APIError(
        APIErrorType.UNKNOWN_ERROR,
        'TMDB client is not initialized. Please check your configuration.'
      );
    }
    return this.tmdbClient;
  }

  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  isUnshackleConnected(): boolean {
    return this.connectionStatus.unshackle === 'connected';
  }

  isTMDBConnected(): boolean {
    return this.connectionStatus.tmdb === 'connected';
  }

  async reconnect(service?: keyof ConnectionStatus): Promise<void> {
    if (!service || service === 'unshackle') {
      await this.testUnshackleConnection();
    }
    
    if (!service || service === 'tmdb') {
      await this.testTMDBConnection();
    }
  }

  updateConfig(newConfig: Partial<APIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize clients with new config
    if (newConfig.unshackle) {
      this.unshackleClient = new UnshackleAPIClient(
        this.config.unshackle.baseURL,
        this.config.unshackle.apiKey
      );
      this.testUnshackleConnection();
    }
    
    if (newConfig.tmdb) {
      this.tmdbClient = new TMDBClient(this.config.tmdb.apiKey);
      this.testTMDBConnection();
    }
  }

  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.unshackleClient) {
      this.unshackleClient.disconnectWebSocket();
    }

    if (this.tmdbClient) {
      this.tmdbClient.clearCache();
    }
  }
}

// Export singleton instance
export const apiClientManager = new APIClientManager();

// Auto-initialize in browser environment
if (typeof window !== 'undefined') {
  apiClientManager.initialize().catch(console.error);
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    apiClientManager.destroy();
  });
}