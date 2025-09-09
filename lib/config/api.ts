/**
 * API configuration for Unshackle API integration.
 */

export const API_CONFIG = {
  // Base URL for the Unshackle API server
  baseUrl: process.env.NEXT_PUBLIC_UNSHACKLE_API_URL || 'http://localhost:8786',
  
  // API version prefix
  version: 'v1',
  
  // Request timeout in milliseconds
  timeout: 30000,
  
  // WebSocket configuration
  websocket: {
    url: process.env.NEXT_PUBLIC_UNSHACKLE_WS_URL || 'ws://localhost:8786',
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
  },
  
  // Cache settings
  cache: {
    trackListTtl: 60 * 60 * 1000, // 1 hour
    availabilityTtl: 5 * 60 * 1000, // 5 minutes
  },
};

/**
 * Get the full API URL with version prefix.
 */
export function getApiUrl(endpoint: string = ''): string {
  const baseUrl = `${API_CONFIG.baseUrl}/api/${API_CONFIG.version}`;
  return endpoint ? `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}` : baseUrl;
}

/**
 * Get the WebSocket URL for download progress updates.
 */
export function getWebSocketUrl(path: string = ''): string {
  const wsUrl = API_CONFIG.websocket.url;
  return path ? `${wsUrl}${path.startsWith('/') ? path : `/${path}`}` : wsUrl;
}

/**
 * Environment configuration checker.
 */
export function checkApiConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!API_CONFIG.baseUrl) {
    errors.push('NEXT_PUBLIC_UNSHACKLE_API_URL is not configured');
  }
  
  if (!API_CONFIG.websocket.url) {
    errors.push('NEXT_PUBLIC_UNSHACKLE_WS_URL is not configured');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}