# Development Guide

Complete setup and development guide for Unshackle UI.

## Prerequisites

### System Requirements

- **Node.js** 18.x or later
- **npm** 9.x or later (or **pnpm** 8.x / **yarn** 3.x)
- **Git** for version control

### External Dependencies

1. **Unshackle CLI** - Must be running in API mode
   ```bash
   # Install Unshackle CLI
   git clone https://github.com/unshackle-dl/unshackle.git
   cd unshackle
   uv sync
   
   # Start API server
   uv run unshackle api --host 0.0.0.0 --port 8888 --api-key dev-key-123
   ```

2. **TMDB API Key** - Required for content metadata
   - Register at [themoviedb.org](https://www.themoviedb.org/settings/api)
   - Obtain API key from account settings

## Project Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/unshackle-dl/unshackle-ui.git
cd unshackle-ui

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### 2. Environment Configuration

Edit `.env.local` with your configuration:

```bash
# Unshackle API Configuration
VITE_UNSHACKLE_API_URL=http://localhost:8888
VITE_UNSHACKLE_API_KEY=dev-key-123

# TMDB API Configuration
VITE_TMDB_API_KEY=your_tmdb_api_key_here
VITE_TMDB_BASE_URL=https://api.themoviedb.org/3
VITE_TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w500

# Development Configuration
VITE_APP_ENV=development
VITE_LOG_LEVEL=debug
```

### 3. Start Development Server

```bash
# Start development server
npm run dev

# Server will start at http://localhost:3000
```

## Development Workflow

### Project Structure

```
src/
├── components/           # React components
│   ├── ui/              # Base Shadcn UI components
│   ├── layout/          # Layout components (Header, Navigation)
│   ├── search/          # Search-related components
│   ├── downloads/       # Download management components
│   ├── services/        # Service management components
│   └── common/          # Shared/utility components
├── hooks/               # Custom React hooks
│   ├── api/            # API-specific hooks
│   ├── ui/             # UI-specific hooks
│   └── utils/          # Utility hooks
├── lib/                # Core libraries
│   ├── api/            # API clients (Unshackle, TMDB)
│   ├── types/          # TypeScript definitions
│   ├── utils/          # Helper functions
│   └── constants/      # Application constants
├── stores/             # Zustand state stores
├── pages/              # Page components
├── styles/             # Global styles and themes
└── assets/             # Static assets
```

### Component Development

#### 1. Creating New Components

```bash
# Create component directory
mkdir src/components/my-feature

# Create component files
touch src/components/my-feature/MyComponent.tsx
touch src/components/my-feature/index.ts
```

**Component Template:**
```tsx
// src/components/my-feature/MyComponent.tsx
import { cn } from '@/lib/utils';

interface MyComponentProps {
  className?: string;
  // Add your props here
}

export function MyComponent({ className, ...props }: MyComponentProps) {
  return (
    <div className={cn("my-component-base-styles", className)}>
      {/* Component content */}
    </div>
  );
}
```

**Index Export:**
```tsx
// src/components/my-feature/index.ts
export { MyComponent } from './MyComponent';
export type { MyComponentProps } from './MyComponent';
```

#### 2. Using Shadcn UI Components

```bash
# Add new Shadcn UI component
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog

# Components are automatically added to src/components/ui/
```

#### 3. Styling Guidelines

**Use Tailwind CSS classes:**
```tsx
// Good: Utility classes
<div className="flex items-center space-x-2 p-4 bg-white dark:bg-gray-900">

// Avoid: Custom CSS unless necessary
<div style={{ display: 'flex', alignItems: 'center' }}>
```

**Component variants:**
```tsx
// Use class variants for component states
const variants = {
  default: "bg-primary text-primary-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  outline: "border border-input bg-background",
};

<Button className={cn(variants[variant], className)}>
```

### State Management

#### Zustand Store Development

**Store Template:**
```tsx
// src/stores/myStore.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface MyStoreState {
  // State properties
  data: MyData[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchData: () => Promise<void>;
  updateData: (id: string, updates: Partial<MyData>) => void;
  clearError: () => void;
}

export const useMyStore = create<MyStoreState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      data: [],
      loading: false,
      error: null,
      
      // Actions
      fetchData: async () => {
        set((state) => {
          state.loading = true;
          state.error = null;
        });
        
        try {
          const data = await api.fetchData();
          set((state) => {
            state.data = data;
            state.loading = false;
          });
        } catch (error) {
          set((state) => {
            state.error = error.message;
            state.loading = false;
          });
        }
      },
      
      updateData: (id, updates) => {
        set((state) => {
          const item = state.data.find(item => item.id === id);
          if (item) {
            Object.assign(item, updates);
          }
        });
      },
      
      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },
    }))
  )
);

// Selectors
export const useMyData = () => useMyStore((state) => state.data);
export const useMyLoading = () => useMyStore((state) => state.loading);
export const useMyError = () => useMyStore((state) => state.error);
```

### API Integration

#### Creating API Clients

**Base API Client:**
```tsx
// src/lib/api/base.ts
class BaseAPIClient {
  protected baseURL: string;
  protected headers: Record<string, string>;
  
  constructor(baseURL: string, headers: Record<string, string> = {}) {
    this.baseURL = baseURL;
    this.headers = {
      'Content-Type': 'application/json',
      ...headers,
    };
  }
  
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new APIError(
        response.status,
        response.statusText,
        await response.text()
      );
    }
    
    return response.json();
  }
  
  protected async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }
  
  protected async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  
  protected async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  
  protected async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}
```

**Unshackle API Client:**
```tsx
// src/lib/api/unshackle.ts
import { BaseAPIClient } from './base';
import type { SearchRequest, SearchResponse, DownloadRequest } from '@/lib/types';

class UnshackleAPIClient extends BaseAPIClient {
  constructor(baseURL: string, apiKey: string) {
    super(baseURL, {
      'Authorization': `Bearer ${apiKey}`,
    });
  }
  
  async search(params: SearchRequest): Promise<SearchResponse> {
    return this.post<SearchResponse>('/api/search', params);
  }
  
  async startDownload(params: DownloadRequest): Promise<{ job_id: string }> {
    return this.post<{ job_id: string }>('/api/download', params);
  }
  
  async getJobs(): Promise<DownloadJob[]> {
    return this.get<DownloadJob[]>('/api/jobs');
  }
  
  async getJobStatus(jobId: string): Promise<DownloadJob> {
    return this.get<DownloadJob>(`/api/status/${jobId}`);
  }
  
  async cancelJob(jobId: string): Promise<void> {
    return this.delete<void>(`/api/jobs/${jobId}`);
  }
  
  async getServices(): Promise<ServiceInfo[]> {
    return this.get<ServiceInfo[]>('/api/services');
  }
}

export const unshackleAPI = new UnshackleAPIClient(
  import.meta.env.VITE_UNSHACKLE_API_URL,
  import.meta.env.VITE_UNSHACKLE_API_KEY
);
```

#### React Query Integration

**Query Hooks:**
```tsx
// src/hooks/api/useUnshackleAPI.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { unshackleAPI } from '@/lib/api/unshackle';

export function useSearch(service: string, query: string) {
  return useQuery({
    queryKey: ['search', service, query],
    queryFn: () => unshackleAPI.search({ service, query }),
    enabled: !!service && !!query,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDownloadJobs() {
  return useQuery({
    queryKey: ['download-jobs'],
    queryFn: () => unshackleAPI.getJobs(),
    refetchInterval: 2000, // Poll every 2 seconds
  });
}

export function useStartDownload() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: unshackleAPI.startDownload,
    onSuccess: () => {
      // Invalidate jobs query to refetch
      queryClient.invalidateQueries({ queryKey: ['download-jobs'] });
    },
  });
}
```

### Custom Hooks

#### UI Hooks

```tsx
// src/hooks/ui/useLocalStorage.ts
import { useState, useEffect } from 'react';

export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving to localStorage:`, error);
    }
  }, [key, value]);
  
  return [value, setValue];
}
```

```tsx
// src/hooks/ui/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
}
```

#### WebSocket Hook

```tsx
// src/hooks/api/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  data: any;
}

export function useWebSocket(url: string) {
  const ws = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  
  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    ws.current = new WebSocket(url);
    
    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };
    
    ws.current.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'job_update':
          // Update jobs in React Query cache
          queryClient.setQueryData(['download-jobs'], (old: any) => {
            if (!old) return old;
            
            const jobs = old.data || old;
            const updatedJob = message.data;
            
            return jobs.map((job: any) => 
              job.id === updatedJob.id ? updatedJob : job
            );
          });
          break;
      }
    };
    
    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt to reconnect after 3 seconds
      setTimeout(connect, 3000);
    };
    
    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [url, queryClient]);
  
  useEffect(() => {
    connect();
    
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);
  
  return { connect };
}
```

## Available Scripts

### Development

```bash
# Start development server
npm run dev

# Start development server with host binding
npm run dev -- --host

# Build for development with watch mode
npm run build:dev
```

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Build with bundle analysis
npm run build:analyze
```

### Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check

# Run all quality checks
npm run check-all
```

### Testing

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E tests in UI mode
npm run test:e2e:ui
```

## Development Tools

### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "'([^']*)'"],
    ["clsx\\(([^)]*)\\)", "'([^']*)'"]
  ]
}
```

### VS Code Extensions

```json
// .vscode/extensions.json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "usernamehw.errorlens",
    "christian-kohler.path-intellisense",
    "ms-playwright.playwright"
  ]
}
```

### Browser DevTools

**React DevTools:**
- Install React Developer Tools extension
- Enable Profiler for performance debugging

**Redux DevTools:**
- Install Redux DevTools extension for Zustand debugging
- Enable in development environment

## Debugging

### Component Debugging

```tsx
// Add debug logging to components
import { useEffect } from 'react';

function MyComponent(props) {
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('MyComponent props:', props);
    }
  }, [props]);
  
  return <div>...</div>;
}
```

### API Debugging

```tsx
// Add request/response logging
const debugAPI = import.meta.env.DEV;

class APIClient {
  async request(url: string, options: RequestInit) {
    if (debugAPI) {
      console.log('API Request:', { url, options });
    }
    
    const response = await fetch(url, options);
    
    if (debugAPI) {
      console.log('API Response:', {
        status: response.status,
        headers: Object.fromEntries(response.headers),
      });
    }
    
    return response;
  }
}
```

### State Debugging

```tsx
// Add state change logging
import { subscribeWithSelector } from 'zustand/middleware';

const useStore = create(
  subscribeWithSelector((set, get) => ({
    // store implementation
  }))
);

// Subscribe to state changes in development
if (import.meta.env.DEV) {
  useStore.subscribe(
    (state) => state,
    (state, prevState) => {
      console.log('State changed:', { prevState, state });
    }
  );
}
```

## Performance Optimization

### Bundle Analysis

```bash
# Analyze bundle size
npm run build:analyze

# View bundle analyzer report
open dist/report.html
```

### Code Splitting

```tsx
// Route-based code splitting
import { lazy, Suspense } from 'react';

const SearchPage = lazy(() => import('./pages/SearchPage'));
const QueuePage = lazy(() => import('./pages/QueuePage'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/queue" element={<QueuePage />} />
      </Routes>
    </Suspense>
  );
}
```

### Image Optimization

```tsx
// Optimized image loading
function OptimizedImage({ src, alt, className }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <div className={cn("relative", className)}>
      {!loaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={cn(
          "transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
```

## Troubleshooting

### Common Issues

**1. API Connection Issues**
```bash
# Check if Unshackle API is running
curl http://localhost:8888/

# Check API key configuration
echo $VITE_UNSHACKLE_API_KEY
```

**2. TMDB API Issues**
```bash
# Test TMDB API key
curl "https://api.themoviedb.org/3/search/movie?api_key=YOUR_KEY&query=test"
```

**3. Build Issues**
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

**4. Type Errors**
```bash
# Regenerate TypeScript definitions
npm run type-check

# Clear TypeScript cache
rm -rf node_modules/.cache
```

### Debug Mode

Enable debug logging by setting environment variables:

```bash
# Enable debug mode
VITE_LOG_LEVEL=debug npm run dev

# Enable API debugging
VITE_DEBUG_API=true npm run dev
```

This development guide provides everything needed to set up, develop, and debug the Unshackle UI effectively.