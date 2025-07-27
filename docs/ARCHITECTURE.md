# Architecture Guide

Comprehensive architecture documentation for Unshackle UI.

## System Overview

Unshackle UI is designed as a standalone web application that communicates with the Unshackle CLI via its API mode. This separation allows for flexible deployment and keeps the CLI lightweight for users who prefer command-line operation.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                              │
├─────────────────────────────────────────────────────────────────┤
│                     Unshackle UI Frontend                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   React App     │ │  State Stores   │ │   API Clients   │   │
│  │  (Components)   │ │   (Zustand)     │ │ (Unshackle+TMDB)│   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                      Network Layer                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   HTTP/REST     │ │    WebSocket    │ │   TMDB API      │   │
│  │  (Unshackle)    │ │  (Real-time)    │ │ (Metadata)      │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                   External Services                             │
│  ┌─────────────────┐ ┌─────────────────┐                       │
│  │  Unshackle CLI  │ │   TMDB API      │                       │
│  │   (API Mode)    │ │   (v3)          │                       │
│  │   Port: 8888    │ │                 │                       │
│  └─────────────────┘ └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Component Hierarchy

```
App
├── Providers
│   ├── ThemeProvider (dark/light mode)
│   ├── QueryProvider (TanStack Query)
│   └── ToastProvider (notifications)
├── Layout
│   ├── AppHeader
│   │   ├── Logo
│   │   ├── ThemeToggle
│   │   ├── StatusIndicator
│   │   └── UserMenu
│   ├── Navigation
│   │   ├── SearchTab (default)
│   │   ├── QueueTab
│   │   ├── HistoryTab
│   │   └── ServicesTab
│   └── MainContent
│       ├── SearchPage
│       ├── QueuePage
│       ├── HistoryPage
│       └── ServicesPage
└── Modals
    ├── DownloadOptionsModal
    ├── ServiceAuthModal
    ├── SettingsModal
    └── ConfirmationModal
```

### State Management Architecture

Using Zustand for predictable state management with clear separation of concerns:

```typescript
// Store Structure
interface AppState {
  // Search State
  search: {
    tmdbQuery: string;
    tmdbResults: TMDBResult[];
    selectedTitle: TMDBResult | null;
    selectedServices: string[];
    serviceSearchStatus: SearchStatus;
    aggregatedResults: AggregatedResult | null;
  };
  
  // Download State
  downloads: {
    queue: DownloadJob[];
    activeDownloads: DownloadJob[];
    completedDownloads: DownloadJob[];
    selectedOptions: DownloadOptions;
  };
  
  // Service State
  services: {
    availableServices: ServiceInfo[];
    authStatus: Record<string, AuthStatus>;
    healthChecks: Record<string, HealthStatus>;
  };
  
  // UI State
  ui: {
    theme: 'light' | 'dark';
    currentTab: TabId;
    modals: Record<string, boolean>;
    notifications: NotificationState[];
  };
}
```

### Data Flow Patterns

#### 1. Search Flow

```
User Input → TMDB Search → Result Selection → Multi-Service Search → Result Aggregation
```

**Detailed Flow:**
1. User types in search input
2. Debounced TMDB API call
3. Display TMDB results with rich metadata
4. User selects specific title and services
5. Parallel API calls to selected Unshackle services
6. Aggregate and deduplicate results
7. Display unified results with download options

#### 2. Download Flow

```
Download Request → Options Selection → Queue Addition → API Call → Progress Tracking
```

**Detailed Flow:**
1. User clicks download on search result
2. Open download options modal
3. Configure quality, HDR, audio options
4. Add to download queue
5. API call to Unshackle with parameters
6. Real-time progress tracking via WebSocket
7. Completion notification and queue update

#### 3. Real-time Updates Flow

```
WebSocket Connection → Message Handling → Store Updates → UI Re-render
```

**Update Types:**
- Download progress updates
- Queue status changes
- Service health status
- Error notifications
- Completion events

## API Integration Architecture

### Unshackle CLI API Integration

**Connection Management:**
```typescript
class UnshackleAPIClient {
  private baseURL: string;
  private apiKey: string;
  private wsConnection: WebSocket | null = null;
  
  // HTTP Methods
  async search(params: SearchParams): Promise<SearchResponse>;
  async download(params: DownloadParams): Promise<DownloadResponse>;
  async getJobs(): Promise<JobsResponse>;
  async cancelJob(jobId: string): Promise<void>;
  async getServices(): Promise<ServicesResponse>;
  
  // WebSocket Methods
  connectWebSocket(): void;
  subscribeToUpdates(callback: UpdateCallback): void;
  handleReconnection(): void;
}
```

**Error Handling Strategy:**
- Exponential backoff for failed requests
- Circuit breaker pattern for service health
- Graceful degradation for partial failures
- User-friendly error messages
- Automatic retry for transient failures

### TMDB API Integration

**Purpose:**
- Content metadata enrichment
- Poster and backdrop images
- Cast and crew information
- User ratings and reviews
- Release dates and genres

**Caching Strategy:**
```typescript
interface TMDBCache {
  searchResults: Map<string, TMDBResult[]>;
  contentDetails: Map<number, TMDBDetail>;
  images: Map<string, string>; // URL cache
  
  // Cache configuration
  searchTTL: number; // 1 hour
  detailsTTL: number; // 24 hours
  imagesTTL: number; // 7 days
}
```

**Rate Limiting:**
- Request queuing with intelligent batching
- Response caching to minimize API calls
- Image lazy loading with progressive enhancement
- Fallback to basic data when API unavailable

## Component Design Patterns

### 1. Compound Components

Used for complex UI sections with multiple related parts:

```typescript
// Search interface compound component
<SearchInterface>
  <SearchInterface.Hero>
    <SearchInterface.Input />
    <SearchInterface.ServiceSelector />
  </SearchInterface.Hero>
  
  <SearchInterface.Results>
    <SearchInterface.TMDBResults />
    <SearchInterface.ServiceResults />
  </SearchInterface.Results>
</SearchInterface>
```

### 2. Render Props

For flexible, reusable logic sharing:

```typescript
// Download progress component
<DownloadProgress jobId={jobId}>
  {({ progress, status, error }) => (
    <div>
      <ProgressBar value={progress} />
      <StatusBadge status={status} />
      {error && <ErrorMessage error={error} />}
    </div>
  )}
</DownloadProgress>
```

### 3. Custom Hooks

For encapsulating complex logic and side effects:

```typescript
// Multi-service search hook
function useMultiServiceSearch() {
  const [searchState, setSearchState] = useState<SearchState>();
  
  const searchServices = useCallback(async (title: TMDBResult, services: string[]) => {
    // Implementation
  }, []);
  
  return {
    searchState,
    searchServices,
    isLoading: searchState?.status === 'loading',
    hasResults: !!searchState?.results,
  };
}
```

## Performance Architecture

### 1. Code Splitting

Strategic bundle splitting for optimal loading:

```typescript
// Route-based splitting
const SearchPage = lazy(() => import('./pages/SearchPage'));
const QueuePage = lazy(() => import('./pages/QueuePage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));

// Feature-based splitting
const DownloadOptionsModal = lazy(() => import('./modals/DownloadOptionsModal'));
```

### 2. Data Fetching Strategy

**TanStack Query Configuration:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // Custom retry logic based on error type
        return failureCount < 3 && isRetryableError(error);
      },
    },
  },
});
```

**Query Patterns:**
- Background refetching for real-time data
- Optimistic updates for instant UI feedback
- Parallel queries for independent data
- Dependent queries for sequential operations

### 3. Image Optimization

**TMDB Images:**
- Multiple resolution support (w154, w342, w500, w780)
- Progressive loading with blur placeholders
- WebP format with JPEG fallback
- Lazy loading below the fold

**Optimization Strategy:**
```typescript
interface ImageConfig {
  sizes: {
    poster: 'w154' | 'w342' | 'w500';
    backdrop: 'w300' | 'w780' | 'w1280';
  };
  
  loading: 'lazy' | 'eager';
  placeholder: 'blur' | 'empty';
  fallback: string; // Default image URL
}
```

## Security Architecture

### 1. API Security

**Authentication:**
- Bearer token authentication with Unshackle API
- Secure token storage (httpOnly if possible)
- Token validation and refresh logic
- Rate limiting awareness

**CORS Configuration:**
```typescript
// Unshackle API CORS setup
const corsConfig = {
  origin: ['http://localhost:3000', 'https://your-domain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
```

### 2. Client Security

**Input Validation:**
- All user inputs sanitized
- Search query length limits
- File path validation
- API response validation with Zod schemas

**XSS Prevention:**
- React's built-in XSS protection
- Sanitization of user-generated content
- CSP headers for additional protection

## Scalability Considerations

### 1. State Management Scaling

**Store Composition:**
```typescript
// Composable stores for different domains
const useAppStore = create<AppState>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        // Store implementation
      })),
      {
        name: 'unshackle-ui-store',
        partialize: (state) => ({
          // Only persist specific parts
          ui: { theme: state.ui.theme },
          services: { authStatus: state.services.authStatus },
        }),
      }
    )
  )
);
```

### 2. Component Scaling

**Virtual Scrolling:**
For large lists of search results or download history:
```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={searchResults.length}
  itemSize={120}
  itemData={searchResults}
>
  {SearchResultItem}
</FixedSizeList>
```

### 3. Network Scaling

**Request Optimization:**
- Request deduplication
- Background sync for offline support
- Intelligent prefetching
- Connection pooling for WebSocket

## Testing Architecture

### 1. Testing Strategy

**Test Pyramid:**
```
E2E Tests (Playwright)
├── Critical user journeys
├── Cross-browser compatibility
└── Real API integration

Integration Tests (React Testing Library)
├── Component interactions
├── API mocking
└── State management

Unit Tests (Vitest)
├── Utility functions
├── Custom hooks
├── API clients
└── Business logic
```

### 2. Mock Strategy

**API Mocking:**
```typescript
// MSW handlers for testing
export const handlers = [
  rest.get('/api/search', (req, res, ctx) => {
    return res(ctx.json(mockSearchResults));
  }),
  
  rest.post('/api/download', (req, res, ctx) => {
    return res(ctx.json(mockDownloadResponse));
  }),
];
```

## Deployment Architecture

### 1. Build Configuration

**Vite Configuration:**
```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select'],
          utils: ['zustand', '@tanstack/react-query'],
        },
      },
    },
  },
  
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});
```

### 2. Environment Configuration

**Multi-Environment Support:**
```typescript
interface EnvironmentConfig {
  development: {
    UNSHACKLE_API_URL: 'http://localhost:8888';
    TMDB_API_URL: 'https://api.themoviedb.org/3';
    LOG_LEVEL: 'debug';
  };
  
  production: {
    UNSHACKLE_API_URL: process.env.UNSHACKLE_API_URL;
    TMDB_API_URL: 'https://api.themoviedb.org/3';
    LOG_LEVEL: 'error';
  };
}
```

### 3. Docker Configuration

**Multi-stage Build:**
```dockerfile
# Build stage
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Runtime stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

This architecture provides a solid foundation for building a scalable, maintainable, and performant web interface for Unshackle.