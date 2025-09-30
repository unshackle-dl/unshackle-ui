/**
 * API configuration for Unshackle API integration.
 * Supports runtime overrides via localStorage.
 */

// Get config with localStorage overrides
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return (
      localStorage.getItem('UNSHACKLE_API_URL') ||
      process.env.NEXT_PUBLIC_UNSHACKLE_API_URL ||
      'http://localhost:8786'
    );
  }
  return process.env.NEXT_PUBLIC_UNSHACKLE_API_URL || 'http://localhost:8786';
}

function getApiKey(): string {
  if (typeof window !== 'undefined') {
    return (
      localStorage.getItem('UNSHACKLE_API_KEY') ||
      process.env.NEXT_PUBLIC_UNSHACKLE_API_KEY ||
      'your-secret-key-here'
    );
  }
  return process.env.NEXT_PUBLIC_UNSHACKLE_API_KEY || 'your-secret-key-here';
}

export const API_CONFIG = {
  // Base URL for the Unshackle API server (can be overridden via localStorage)
  get baseUrl() {
    return getBaseUrl();
  },

  // API key for authentication (can be overridden via localStorage)
  get apiKey() {
    return getApiKey();
  },

  // Request timeout in milliseconds
  // Increased to 5 minutes for list-tracks (can take 2-5 min for track info)
  // Download operations are async (job-based) so don't need longer timeout
  timeout: 300000, // 5 minutes

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
 * Get the full API URL (no version prefix needed - the new API uses /api/ directly).
 */
export function getApiUrl(endpoint: string = ''): string {
  const baseUrl = `${API_CONFIG.baseUrl}/api`;
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
