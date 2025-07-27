import { UnshackleAPIClient } from './unshackle-client';
import { TMDBClient } from './tmdb-client';

// Export classes
export { UnshackleAPIClient, TMDBClient };

// Create singleton instances
const unshackleClient = new UnshackleAPIClient(
  import.meta.env.VITE_UNSHACKLE_API_URL || 'http://localhost:8888',
  import.meta.env.VITE_UNSHACKLE_API_KEY || ''
);

const tmdbClient = new TMDBClient(
  import.meta.env.VITE_TMDB_API_KEY || ''
);

export { unshackleClient, tmdbClient };