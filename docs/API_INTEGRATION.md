# API Integration Guide

Comprehensive guide for integrating with Unshackle CLI API and TMDB API.

## Overview

Unshackle UI integrates with two primary APIs:
1. **Unshackle CLI API** - Core functionality (search, download, queue management)
2. **TMDB API v3** - Content metadata enrichment (posters, descriptions, ratings)

## Unshackle CLI API Integration

### API Setup and Configuration

The Unshackle CLI must be running in API mode for the UI to function:

```bash
# Start Unshackle in API mode
uv run unshackle api --host 0.0.0.0 --port 8888 --api-key your-secure-key
```

### Authentication

**Bearer Token Authentication:**
```typescript
// API client configuration
class UnshackleAPIClient {
  private baseURL: string;
  private apiKey: string;
  
  constructor(baseURL: string, apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }
  
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }
}
```

### Core API Endpoints

#### 1. Search Endpoint

**Endpoint:** `POST /api/search`

**Purpose:** Search for content across streaming services

```typescript
interface SearchRequest {
  service: string;    // Service ID (e.g., 'NF', 'DSNP', 'AMZN')
  query: string;      // Search query (title name)
  type?: string;      // Content type filter ('movie', 'tv', 'music')
}

interface SearchResponse {
  status: 'success' | 'error';
  timestamp: string;
  data: SearchResult[];
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

interface SearchResult {
  id: string;
  title: string;
  type: 'movie' | 'tv' | 'music';
  year?: number;
  description?: string;
  service: string;
}
```

**Usage Example:**
```typescript
async function searchContent(service: string, query: string): Promise<SearchResult[]> {
  const response = await fetch(`${API_BASE_URL}/api/search`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      service,
      query,
      type: 'movie' // Optional filter
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }
  
  const data: SearchResponse = await response.json();
  
  if (data.status === 'error') {
    throw new Error(data.error?.message || 'Search failed');
  }
  
  return data.data;
}
```

#### 2. Download Endpoint

**Endpoint:** `POST /api/download`

**Purpose:** Start a download job

```typescript
interface DownloadRequest {
  service: string;
  content_id: string;
  quality?: string;           // '720p', '1080p', '4k'
  output_path?: string;
  
  // Advanced options (passed as CLI flags)
  hdr10?: boolean;
  dolby_vision?: boolean;
  atmos?: boolean;
  subtitles?: boolean;
  audio_tracks?: string[];
}

interface DownloadResponse {
  status: 'success' | 'error';
  timestamp: string;
  data: {
    job_id: string;
  };
  message: string;
}
```

**Usage Example:**
```typescript
async function startDownload(params: DownloadRequest): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/download`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  
  const data: DownloadResponse = await response.json();
  
  if (data.status === 'error') {
    throw new Error(data.error?.message || 'Download failed to start');
  }
  
  return data.data.job_id;
}
```

#### 3. Job Management Endpoints

**Get Job Status:** `GET /api/status/{job_id}`
**Get All Jobs:** `GET /api/jobs`
**Cancel Job:** `DELETE /api/jobs/{job_id}`

```typescript
interface DownloadJob {
  id: string;
  service: string;
  content_id: string;
  content_title: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed';
  progress?: number;          // 0-100
  current_file?: string;
  total_files?: number;
  downloaded_bytes?: number;
  total_bytes?: number;
  error?: string;
  start_time: string;
  end_time?: string;
}
```

#### 4. Services Endpoint

**Endpoint:** `GET /api/services`

**Purpose:** Get available streaming services and their status

```typescript
interface ServiceInfo {
  id: string;           // Service identifier
  name: string;         // Display name
  status: 'available' | 'unavailable' | 'error';
  description?: string;
  requires_auth: boolean;
  auth_status?: 'authenticated' | 'unauthenticated' | 'expired';
}
```

### Real-time Updates

#### WebSocket Connection

**Endpoint:** `ws://localhost:8888/ws`

**Purpose:** Real-time download progress and status updates

```typescript
class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  connect(url: string): void {
    this.ws = new WebSocket(url);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.handleReconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'job_update':
        // Update job in store
        updateJobInStore(message.data);
        break;
      case 'service_status':
        // Update service status
        updateServiceStatus(message.data);
        break;
    }
  }
  
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect(this.url);
      }, Math.pow(2, this.reconnectAttempts) * 1000); // Exponential backoff
    }
  }
}
```

#### Polling Fallback

For cases where WebSocket is unavailable:

```typescript
class PollingManager {
  private intervalId: number | null = null;
  private readonly POLL_INTERVAL = 2000; // 2 seconds
  
  startPolling(callback: (jobs: DownloadJob[]) => void): void {
    this.intervalId = setInterval(async () => {
      try {
        const jobs = await fetchJobs();
        callback(jobs);
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, this.POLL_INTERVAL);
  }
  
  stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
```

### Error Handling

#### Error Types and Handling

```typescript
interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

class APIErrorHandler {
  static handle(error: APIError): void {
    switch (error.code) {
      case 'UNAUTHORIZED':
        // Redirect to authentication
        handleAuthError();
        break;
      case 'RATE_LIMITED':
        // Show rate limit message
        showRateLimitWarning();
        break;
      case 'SERVICE_UNAVAILABLE':
        // Show service down message
        showServiceDownError(error.details?.service);
        break;
      case 'INVALID_CONTENT':
        // Show content not found message
        showContentNotFoundError();
        break;
      default:
        // Show generic error
        showGenericError(error.message);
    }
  }
}
```

#### Retry Logic

```typescript
class RetryManager {
  static async withRetry<T>(
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
  
  private static isRetryableError(error: any): boolean {
    // Network errors, timeouts, and 5xx status codes are retryable
    return (
      error.name === 'NetworkError' ||
      error.code === 'ECONNRESET' ||
      (error.status >= 500 && error.status < 600)
    );
  }
  
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## TMDB API Integration

### API Setup

**Authentication:** API Key in query parameter or header

```typescript
class TMDBClient {
  private apiKey: string;
  private baseURL = 'https://api.themoviedb.org/3';
  private imageBaseURL = 'https://image.tmdb.org/t/p';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  private async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const url = new URL(`${this.baseURL}${endpoint}`);
    url.searchParams.set('api_key', this.apiKey);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`);
    }
    
    return response.json();
  }
}
```

### Core TMDB Endpoints

#### 1. Multi Search

**Purpose:** Search across movies, TV shows, and people

```typescript
interface TMDBSearchParams {
  query: string;
  page?: number;
  include_adult?: boolean;
  region?: string;
  year?: number;
  primary_release_year?: number; // For movies
  first_air_date_year?: number;  // For TV shows
}

interface TMDBSearchResult {
  id: number;
  media_type: 'movie' | 'tv' | 'person';
  title?: string;          // For movies
  name?: string;           // For TV shows
  original_title?: string; // For movies
  original_name?: string;  // For TV shows
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;   // For movies
  first_air_date?: string; // For TV shows
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  adult: boolean;
  original_language: string;
  popularity: number;
}

async function searchMulti(query: string): Promise<TMDBSearchResult[]> {
  const response = await tmdbClient.request<{results: TMDBSearchResult[]}>('/search/multi', {
    query,
    include_adult: false,
  });
  
  return response.results.filter(result => 
    result.media_type === 'movie' || result.media_type === 'tv'
  );
}
```

#### 2. Movie Details

```typescript
interface TMDBMovieDetails {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date: string;
  runtime: number;
  vote_average: number;
  vote_count: number;
  genres: Array<{ id: number; name: string }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages: Array<{ iso_639_1: string; name: string }>;
  imdb_id: string;
  tagline: string;
  budget: number;
  revenue: number;
  status: string;
}

async function getMovieDetails(movieId: number): Promise<TMDBMovieDetails> {
  return tmdbClient.request<TMDBMovieDetails>(`/movie/${movieId}`);
}
```

#### 3. TV Show Details

```typescript
interface TMDBTVDetails {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  first_air_date: string;
  last_air_date: string;
  number_of_episodes: number;
  number_of_seasons: number;
  episode_run_time: number[];
  vote_average: number;
  vote_count: number;
  genres: Array<{ id: number; name: string }>;
  networks: Array<{ id: number; name: string; logo_path: string }>;
  seasons: Array<{
    id: number;
    season_number: number;
    episode_count: number;
    air_date: string;
    poster_path: string;
  }>;
  status: string;
  type: string;
}

async function getTVDetails(tvId: number): Promise<TMDBTVDetails> {
  return tmdbClient.request<TMDBTVDetails>(`/tv/${tvId}`);
}
```

### Image URL Construction

```typescript
class TMDBImageManager {
  private baseURL = 'https://image.tmdb.org/t/p';
  
  // Poster sizes: w92, w154, w185, w342, w500, w780, original
  getPosterURL(path: string, size: string = 'w500'): string {
    return `${this.baseURL}/${size}${path}`;
  }
  
  // Backdrop sizes: w300, w780, w1280, original
  getBackdropURL(path: string, size: string = 'w1280'): string {
    return `${this.baseURL}/${size}${path}`;
  }
  
  // Get multiple sizes for responsive images
  getResponsivePosterSizes(path: string): {
    small: string;
    medium: string;
    large: string;
  } {
    return {
      small: this.getPosterURL(path, 'w154'),
      medium: this.getPosterURL(path, 'w342'),
      large: this.getPosterURL(path, 'w500'),
    };
  }
}
```

### Data Enrichment Strategy

#### Matching TMDB with Unshackle Results

```typescript
interface EnhancedSearchResult {
  // Unshackle data
  unshackleResult: SearchResult;
  
  // TMDB enrichment
  tmdbData?: TMDBSearchResult;
  tmdbDetails?: TMDBMovieDetails | TMDBTVDetails;
  
  // Computed fields
  displayTitle: string;
  displayYear: string;
  posterURL?: string;
  backdropURL?: string;
  description?: string;
  rating?: number;
  genres?: string[];
}

class DataEnrichmentService {
  async enrichSearchResults(
    unshackleResults: SearchResult[],
    tmdbSearchResults: TMDBSearchResult[]
  ): Promise<EnhancedSearchResult[]> {
    return Promise.all(
      unshackleResults.map(async (unshackleResult) => {
        // Find matching TMDB result
        const tmdbMatch = this.findBestMatch(unshackleResult, tmdbSearchResults);
        
        // Get detailed information if match found
        let tmdbDetails: TMDBMovieDetails | TMDBTVDetails | undefined;
        if (tmdbMatch) {
          tmdbDetails = await this.getDetailedInfo(tmdbMatch);
        }
        
        return {
          unshackleResult,
          tmdbData: tmdbMatch,
          tmdbDetails,
          displayTitle: tmdbDetails?.title || tmdbDetails?.name || unshackleResult.title,
          displayYear: this.extractYear(tmdbDetails),
          posterURL: tmdbMatch?.poster_path ? 
            tmdbImageManager.getPosterURL(tmdbMatch.poster_path) : undefined,
          description: tmdbDetails?.overview,
          rating: tmdbDetails?.vote_average,
          genres: tmdbDetails?.genres?.map(g => g.name),
        };
      })
    );
  }
  
  private findBestMatch(
    unshackleResult: SearchResult,
    tmdbResults: TMDBSearchResult[]
  ): TMDBSearchResult | undefined {
    // Implement fuzzy matching logic
    return tmdbResults.find(tmdbResult => {
      const tmdbTitle = tmdbResult.title || tmdbResult.name || '';
      const similarity = this.calculateSimilarity(
        unshackleResult.title.toLowerCase(),
        tmdbTitle.toLowerCase()
      );
      return similarity > 0.8; // 80% similarity threshold
    });
  }
  
  private calculateSimilarity(str1: string, str2: string): number {
    // Implement Levenshtein distance or similar algorithm
    // Return value between 0 and 1
  }
}
```

### Caching Strategy

```typescript
class TMDBCache {
  private cache = new Map<string, any>();
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 hours
  
  set(key: string, value: any): void {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
    });
  }
  
  get(key: string): any | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    if (Date.now() - item.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  // Cache search results
  async searchWithCache(query: string): Promise<TMDBSearchResult[]> {
    const cacheKey = `search:${query}`;
    const cached = this.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const results = await searchMulti(query);
    this.set(cacheKey, results);
    
    return results;
  }
}
```

## Integration Patterns

### React Query Integration

```typescript
// Custom hooks for API integration
function useUnshackleSearch(service: string, query: string) {
  return useQuery({
    queryKey: ['unshackle-search', service, query],
    queryFn: () => unshackleClient.search({ service, query }),
    enabled: !!service && !!query,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

function useTMDBSearch(query: string) {
  return useQuery({
    queryKey: ['tmdb-search', query],
    queryFn: () => tmdbClient.searchMulti(query),
    enabled: !!query,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

function useEnhancedSearch(services: string[], query: string) {
  const tmdbQuery = useTMDBSearch(query);
  
  const unshackleQueries = useQueries({
    queries: services.map(service => ({
      queryKey: ['unshackle-search', service, query],
      queryFn: () => unshackleClient.search({ service, query }),
      enabled: !!query,
    })),
  });
  
  return useMemo(() => {
    if (tmdbQuery.isLoading || unshackleQueries.some(q => q.isLoading)) {
      return { isLoading: true };
    }
    
    const enrichedResults = enrichSearchResults(
      unshackleQueries.flatMap(q => q.data || []),
      tmdbQuery.data || []
    );
    
    return {
      isLoading: false,
      data: enrichedResults,
    };
  }, [tmdbQuery, unshackleQueries]);
}
```

This comprehensive API integration guide provides the foundation for building a robust and reliable connection between the Unshackle UI and its data sources.