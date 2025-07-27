// Export API clients
export { UnshackleAPIClient } from './unshackle-client';
export { TMDBClient } from './tmdb-client';

// Export configuration and error handling
export { getAPIConfig, validateAPIConfig, type APIConfig } from './api-config';
export { APIError, APIErrorType, isAPIError } from './api-errors';

// Export client manager and utilities
export { apiClientManager, type ConnectionStatus } from './api-client-manager';
export { apiTester, type APITestResult, type APITestSuite } from './api-tester';

// Export query client and cache utilities
export { queryClient, queryKeys, cacheUtils } from './query-client';

// Export React Query hooks
export * from './queries';

// Legacy singleton instances (deprecated - use apiClientManager instead)
import { UnshackleAPIClient } from './unshackle-client';
import { TMDBClient } from './tmdb-client';

const unshackleClient = new UnshackleAPIClient(
  import.meta.env.VITE_UNSHACKLE_API_URL || 'http://localhost:8888',
  import.meta.env.VITE_UNSHACKLE_API_KEY || ''
);

const tmdbClient = new TMDBClient(
  import.meta.env.VITE_TMDB_API_KEY || ''
);

export { unshackleClient, tmdbClient };