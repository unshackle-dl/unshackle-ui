export interface APIConfig {
  unshackle: {
    baseURL: string;
    apiKey: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  tmdb: {
    apiKey: string;
    baseURL: string;
    imageBaseURL: string;
    timeout: number;
    cacheTTL: number;
  };
}

export const defaultAPIConfig: APIConfig = {
  unshackle: {
    baseURL: 'http://localhost:8888',
    apiKey: 'development-key-change-me',
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
  },
  tmdb: {
    apiKey: '',
    baseURL: 'https://api.themoviedb.org/3',
    imageBaseURL: 'https://image.tmdb.org/t/p',
    timeout: 10000, // 10 seconds
    cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
  },
};

export function getAPIConfig(): APIConfig {
  return {
    unshackle: {
      baseURL: import.meta.env.VITE_UNSHACKLE_API_URL || defaultAPIConfig.unshackle.baseURL,
      apiKey: import.meta.env.VITE_UNSHACKLE_API_KEY || defaultAPIConfig.unshackle.apiKey,
      timeout: parseInt(import.meta.env.VITE_UNSHACKLE_TIMEOUT) || defaultAPIConfig.unshackle.timeout,
      retryAttempts: parseInt(import.meta.env.VITE_UNSHACKLE_RETRY_ATTEMPTS) || defaultAPIConfig.unshackle.retryAttempts,
      retryDelay: parseInt(import.meta.env.VITE_UNSHACKLE_RETRY_DELAY) || defaultAPIConfig.unshackle.retryDelay,
    },
    tmdb: {
      apiKey: import.meta.env.VITE_TMDB_API_KEY || defaultAPIConfig.tmdb.apiKey,
      baseURL: import.meta.env.VITE_TMDB_BASE_URL || defaultAPIConfig.tmdb.baseURL,
      imageBaseURL: import.meta.env.VITE_TMDB_IMAGE_BASE || defaultAPIConfig.tmdb.imageBaseURL,
      timeout: parseInt(import.meta.env.VITE_TMDB_TIMEOUT) || defaultAPIConfig.tmdb.timeout,
      cacheTTL: parseInt(import.meta.env.VITE_TMDB_CACHE_TTL) || defaultAPIConfig.tmdb.cacheTTL,
    },
  };
}

export function validateAPIConfig(config: APIConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate Unshackle config
  if (!config.unshackle.baseURL) {
    errors.push('Unshackle API base URL is required');
  }
  
  // Allow development key for local development
  if (!config.unshackle.apiKey && config.unshackle.baseURL !== 'http://localhost:8888') {
    errors.push('Unshackle API key is required for production environments');
  }

  try {
    new URL(config.unshackle.baseURL);
  } catch {
    errors.push('Unshackle API base URL is not a valid URL');
  }

  // Validate TMDB config
  if (!config.tmdb.apiKey) {
    errors.push('TMDB API key is required');
  }

  try {
    new URL(config.tmdb.baseURL);
  } catch {
    errors.push('TMDB API base URL is not a valid URL');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}