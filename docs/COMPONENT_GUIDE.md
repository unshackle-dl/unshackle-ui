# Component Guide

Comprehensive guide for UI components, patterns, and styling in Unshackle UI.

## Design System Overview

Unshackle UI follows a design system inspired by PortraTracker's clean, modern aesthetic with a focus on content discovery and download management.

### Design Principles

1. **Search-First**: The primary user journey starts with content discovery
2. **Visual Clarity**: Rich content cards with posters and metadata
3. **Real-time Feedback**: Live progress indicators and status updates
4. **Responsive Design**: Optimized for desktop and tablet experiences
5. **Accessibility**: WCAG 2.1 AA compliance with keyboard navigation

### Color System

```typescript
// Tailwind CSS color configuration
const colors = {
  // Primary brand colors
  primary: {
    50: '#eff6ff',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    900: '#1e3a8a',
  },
  
  // Success states
  success: {
    50: '#f0fdf4',
    500: '#22c55e',
    600: '#16a34a',
  },
  
  // Warning states
  warning: {
    50: '#fffbeb',
    500: '#f59e0b',
    600: '#d97706',
  },
  
  // Error states
  error: {
    50: '#fef2f2',
    500: '#ef4444',
    600: '#dc2626',
  },
  
  // Neutral grays (dark mode optimized)
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },
};
```

### Typography Scale

```typescript
// Font configuration
const typography = {
  fontFamily: {
    sans: ['Inter', 'ui-sans-serif', 'system-ui'],
    mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular'],
  },
  
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
  },
};
```

### Spacing System

```typescript
// Consistent spacing scale
const spacing = {
  px: '1px',
  0: '0px',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  2: '0.5rem',      // 8px
  3: '0.75rem',     // 12px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  8: '2rem',        // 32px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
};
```

## Component Architecture

### Base Components (Shadcn UI)

These are the foundational components provided by Shadcn UI:

```typescript
// Core UI components
export {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Progress,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toast,
  Toaster,
} from '@/components/ui';
```

### Layout Components

#### DashboardLayout (PortraTracker Pattern)

Advanced dashboard layout with responsive sidebar and mobile-first design.

```tsx
interface DashboardLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  isSidebarOpen: boolean;
  onCloseSidebar: () => void;
}

export function DashboardLayout({
  sidebar,
  children,
  isSidebarOpen,
  onCloseSidebar,
}: DashboardLayoutProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={onCloseSidebar}
          aria-hidden="true"
        />
      )}

      {/* Responsive Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-full max-w-sm transform transition-transform duration-300 ease-in-out bg-white dark:bg-slate-900 
                   md:relative md:w-1/3 md:min-w-[320px] md:max-w-[480px] md:translate-x-0 md:border-r md:border-slate-200 md:dark:border-slate-800
                   ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {sidebar}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
```

#### AppLayout

Main application layout with header, navigation, and content area.

```tsx
interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6">
        <Navigation />
        <div className="mt-6">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}
```

#### AppHeader (Enhanced PortraTracker Pattern)

Feature-rich header with search, filters, auto-refresh, and responsive design.

```tsx
interface AppHeaderProps {
  loading?: boolean;
  autoRefresh?: boolean;
  onRefresh?: () => void;
  setAutoRefresh?: (value: boolean) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchHighlighting?: boolean;
  onSearchHighlightingChange?: (enabled: boolean) => void;
  filters?: Record<string, boolean>;
  onFilterChange?: (filters: Record<string, boolean>) => void;
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
  onGoHome?: () => void;
  onToggleSidebar?: () => void;
  className?: string;
}

export function AppHeader({
  loading,
  autoRefresh,
  onRefresh,
  setAutoRefresh,
  searchTerm,
  onSearchChange,
  searchHighlighting,
  onSearchHighlightingChange,
  filters,
  onFilterChange,
  isDarkMode,
  onThemeToggle,
  onGoHome,
  onToggleSidebar,
  className
}: AppHeaderProps) {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');
  const [searching, setSearching] = useState(false);

  // Debounced search implementation
  useEffect(() => {
    if (localSearchTerm !== searchTerm) {
      setSearching(true);
      const debounceTimer = setTimeout(() => {
        onSearchChange?.(localSearchTerm);
        setSearching(false);
      }, 300);

      return () => {
        clearTimeout(debounceTimer);
        setSearching(false);
      };
    }
  }, [localSearchTerm, searchTerm, onSearchChange]);

  const getInputPadding = () => {
    const hasToggle = !!searchTerm;
    const hasClear = !!localSearchTerm;
    
    if (hasToggle && hasClear) return "pr-20";
    if (hasToggle || hasClear) return "pr-12";
    return "pr-10";
  };

  return (
    <header className={cn(
      "bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 relative flex-shrink-0",
      className
    )}>
      <div className="min-h-16 px-4 sm:px-6 py-2 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left Section: Logo and Mobile Menu */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="p-2 -ml-2 rounded-md md:hidden text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Open sidebar"
          >
            <Menu className="h-6 w-6" />
          </Button>
          
          <Button
            variant="ghost"
            onClick={onGoHome}
            className="flex items-center gap-3 text-xl font-bold text-slate-800 dark:text-slate-200 group cursor-pointer"
          >
            <div className={`h-6 w-6 rounded-sm bg-gradient-to-br from-primary-500 to-primary-600 transition-all duration-300 ease-in-out group-hover:rotate-[30deg] ${
              loading ? "animate-spin" : ""
            }`} />
            <span className="tracking-tighter">unshackle</span>
          </Button>
        </div>

        {/* Right Section: Search, Filters, Controls */}
        <div className="flex items-center flex-wrap justify-center md:justify-end gap-x-4 gap-y-2">
          {/* Enhanced Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              {searching ? (
                <Loader2 className="h-4 w-4 text-primary-500 animate-spin" />
              ) : (
                <Search className="h-4 w-4 text-gray-400" />
              )}
            </div>
            <Input
              type="text"
              placeholder="Search content..."
              className={`pl-10 ${getInputPadding()} w-64 border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
            />
            
            {/* Search Controls */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-2">
              {/* Highlight Toggle */}
              {searchTerm && (
                <label className="inline-flex items-center cursor-pointer" title="Highlight search matches">
                  <input
                    type="checkbox"
                    checked={searchHighlighting}
                    onChange={(e) => onSearchHighlightingChange?.(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className={`relative w-7 h-4 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white ${
                    searchHighlighting
                      ? "bg-primary-600 dark:bg-primary-600"
                      : "bg-gray-200 dark:bg-gray-600"
                  }`} />
                </label>
              )}
              
              {/* Clear Button */}
              {localSearchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLocalSearchTerm("");
                    onSearchChange?.("");
                  }}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-500"
                  title="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Filter Buttons */}
          {filters && (
            <div className="flex space-x-2">
              {Object.entries(filters).map(([key, isActive]) => (
                <Button
                  key={key}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => onFilterChange?.({ ...filters, [key]: !isActive })}
                  className="capitalize"
                >
                  {key}
                </Button>
              ))}
            </div>
          )}

          <div className="h-6 border-l border-gray-200 dark:border-gray-700 hidden sm:block" />

          {/* Auto-refresh Toggle */}
          {setAutoRefresh && (
            <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="sr-only peer"
              />
              <div className={`relative w-9 h-5 rounded-full peer peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white ${
                autoRefresh
                  ? "bg-primary-600 dark:bg-primary-600"
                  : "bg-gray-200 dark:bg-gray-600"
              }`} />
              <span>Auto-refresh</span>
            </label>
          )}

          {/* Refresh Button */}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={loading}
              className="hover:bg-gray-100 dark:hover:bg-gray-800"
              title={loading ? "Refreshing..." : "Refresh data"}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}
            </Button>
          )}

          <div className="h-6 border-l border-gray-200 dark:border-gray-700 hidden sm:block" />

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onThemeToggle}
            className="hover:bg-gray-100 dark:hover:bg-gray-800"
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Auto-refresh Progress Bar */}
      {autoRefresh && (
        <div className="absolute bottom-0 left-0 right-0">
          <RefreshProgress active={autoRefresh} duration={30000} />
        </div>
      )}
    </header>
  );
}
```

#### Simple AppHeader

Basic header implementation for minimal layouts.

```tsx
interface SimpleAppHeaderProps {
  className?: string;
}

export function SimpleAppHeader({ className }: SimpleAppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { connectionStatus } = useConnectionStatus();
  
  return (
    <header className={cn(
      "sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded-sm bg-gradient-to-br from-primary-500 to-primary-600" />
            <span className="font-bold">unshackle</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <ConnectionStatusIndicator status={connectionStatus} />
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="h-9 w-9 px-0"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
```

#### Navigation

Tab-based navigation for different app sections.

```tsx
interface NavigationProps {
  className?: string;
}

export function Navigation({ className }: NavigationProps) {
  const [activeTab, setActiveTab] = useNavigationStore((state) => [
    state.activeTab,
    state.setActiveTab,
  ]);
  
  const tabs = [
    { id: 'search', label: 'Search', icon: Search },
    { id: 'queue', label: 'Queue', icon: Download, badge: useQueueCount() },
    { id: 'history', label: 'History', icon: History },
    { id: 'services', label: 'Services', icon: Server },
  ];
  
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className={className}>
      <TabsList className="grid w-full grid-cols-4">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="relative"
          >
            <tab.icon className="mr-2 h-4 w-4" />
            {tab.label}
            {tab.badge && tab.badge > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                {tab.badge}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
```

### Search Components

#### SearchHero

Main search interface with TMDB search and service selection.

```tsx
interface SearchHeroProps {
  onSearch: (query: string) => void;
  onServiceChange: (services: string[]) => void;
  className?: string;
}

export function SearchHero({ onSearch, onServiceChange, className }: SearchHeroProps) {
  const [query, setQuery] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>(['NF', 'DSNP']);
  const { services } = useServices();
  
  const handleSearch = useCallback(() => {
    if (query.trim()) {
      onSearch(query.trim());
    }
  }, [query, onSearch]);
  
  const handleServiceToggle = useCallback((serviceId: string) => {
    setSelectedServices(prev => {
      const updated = prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId];
      onServiceChange(updated);
      return updated;
    });
  }, [onServiceChange]);
  
  return (
    <div className={cn("space-y-6", className)}>
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Content Discovery & Download Manager
        </h1>
        <p className="text-muted-foreground">
          Search across multiple streaming services and download your content
        </p>
      </div>
      
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex space-x-2">
          <Input
            placeholder="Search for movies, shows, music..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={!query.trim()}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>
        
        <ServiceSelector
          services={services}
          selected={selectedServices}
          onToggle={handleServiceToggle}
        />
      </div>
    </div>
  );
}
```

#### ServiceSelector

Multi-select component for choosing streaming services.

```tsx
interface ServiceSelectorProps {
  services: ServiceInfo[];
  selected: string[];
  onToggle: (serviceId: string) => void;
  className?: string;
}

export function ServiceSelector({ 
  services, 
  selected, 
  onToggle, 
  className 
}: ServiceSelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">Select Services</Label>
      <div className="flex flex-wrap gap-2">
        {services.map((service) => (
          <Button
            key={service.id}
            variant={selected.includes(service.id) ? "default" : "outline"}
            size="sm"
            onClick={() => onToggle(service.id)}
            className="relative"
          >
            <span className="mr-2">{service.name}</span>
            {service.status === 'available' ? (
              <div className="h-2 w-2 rounded-full bg-green-500" />
            ) : (
              <div className="h-2 w-2 rounded-full bg-red-500" />
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

#### ContentGrid

Grid layout for displaying search results with rich cards.

```tsx
interface ContentGridProps {
  results: EnhancedSearchResult[];
  onDownload: (result: EnhancedSearchResult) => void;
  viewMode: 'grid' | 'list';
  className?: string;
}

export function ContentGrid({ 
  results, 
  onDownload, 
  viewMode, 
  className 
}: ContentGridProps) {
  if (viewMode === 'list') {
    return (
      <div className={cn("space-y-2", className)}>
        {results.map((result) => (
          <ContentListItem
            key={`${result.unshackleResult.service}-${result.unshackleResult.id}`}
            result={result}
            onDownload={onDownload}
          />
        ))}
      </div>
    );
  }
  
  return (
    <div className={cn(
      "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4",
      className
    )}>
      {results.map((result) => (
        <ContentCard
          key={`${result.unshackleResult.service}-${result.unshackleResult.id}`}
          result={result}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}
```

#### ContentCard

Individual content card with poster, overlay, and download button.

```tsx
interface ContentCardProps {
  result: EnhancedSearchResult;
  onDownload: (result: EnhancedSearchResult) => void;
  className?: string;
}

export function ContentCard({ result, onDownload, className }: ContentCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const downloadStatus = useDownloadStatus(result.unshackleResult.id);
  
  return (
    <Card className={cn("group relative overflow-hidden", className)}>
      <div className="aspect-[2/3] relative">
        {/* Poster Image */}
        {result.posterURL && !imageError ? (
          <img
            src={result.posterURL}
            alt={result.displayTitle}
            className={cn(
              "w-full h-full object-cover transition-all duration-300",
              "group-hover:scale-105",
              imageLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Film className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        
        {/* Loading State */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
            <h3 className="text-white font-semibold text-sm line-clamp-2">
              {result.displayTitle}
            </h3>
            <div className="flex items-center justify-between text-xs text-gray-300">
              <span>{result.displayYear}</span>
              {result.rating && (
                <div className="flex items-center space-x-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span>{result.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={() => onDownload(result)}
              disabled={downloadStatus?.status === 'downloading'}
            >
              {downloadStatus?.status === 'downloading' ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Downloading
                </>
              ) : (
                <>
                  <Download className="h-3 w-3 mr-2" />
                  Download
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Download Progress Indicator */}
        {downloadStatus?.status === 'downloading' && downloadStatus.progress && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${downloadStatus.progress}%` }}
            />
          </div>
        )}
        
        {/* Service Badge */}
        <Badge
          variant="secondary"
          className="absolute top-2 left-2 text-xs"
        >
          {result.unshackleResult.service}
        </Badge>
      </div>
    </Card>
  );
}
```

### PortraTracker-Inspired Components

#### PortCard (Adaptive Item Pattern)

Flexible card component for displaying ports, services, or any resource with status indicators.

```tsx
interface PortCardProps {
  port: {
    host_port: string | number;
    host_ip: string;
    target?: string;
    owner: string;
    source: 'docker' | 'system';
    created?: string;
    note?: string;
  };
  serverId?: string;
  serverUrl?: string;
  searchTerm?: string;
  onCopy?: (port: any, protocol: string) => void;
  onEdit?: (port: any) => void;
  onToggleIgnore?: (port: any) => void;
  className?: string;
}

// Search highlighting utility
const renderHighlightedText = (content: any) => {
  if (typeof content === "string") return content;
  if (!content.isHighlighted) return content;

  return content.parts.map((part: any, index: number) =>
    part.highlighted ? (
      <mark
        key={index}
        className="bg-yellow-200 dark:bg-yellow-800/50 text-yellow-900 dark:text-yellow-200 px-0.5 rounded"
      >
        {part.text}
      </mark>
    ) : (
      <span key={index}>{part.text}</span>
    )
  );
};

export function PortCard({ 
  port, 
  serverId, 
  serverUrl, 
  searchTerm, 
  onCopy, 
  onEdit, 
  onToggleIgnore, 
  className 
}: PortCardProps) {
  const [protocol, setProtocol] = useState("http");
  const shouldHighlight = !!searchTerm;
  
  // Smart host resolution for localhost/container IPs
  let hostForUi = port.host_ip;
  if (port.host_ip === "0.0.0.0" || port.host_ip === "127.0.0.1") {
    if (serverId === "local") {
      hostForUi = window.location.hostname;
    } else if (serverUrl) {
      try {
        hostForUi = new URL(serverUrl).hostname;
      } catch {
        hostForUi = "localhost";
      }
    } else {
      hostForUi = "localhost";
    }
  }
  
  const clickableUrl = `${protocol}://${hostForUi}:${port.host_port}`;

  return (
    <li
      tabIndex={0}
      className={cn(
        "flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-800/50",
        className
      )}
    >
      <div className="flex items-center space-x-4 flex-1 min-w-0">
        {/* Port Number with Status */}
        <div className="flex items-center space-x-2">
          <StatusIndicator
            port={port}
            serverId={serverId}
            serverUrl={serverUrl}
            onProtocolChange={setProtocol}
          />
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={clickableUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/link inline-flex items-center space-x-1"
                >
                  <Badge variant="outline" className="text-lg font-medium bg-primary-50 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200">
                    {shouldHighlight
                      ? renderHighlightedText(highlightText(port.host_port.toString(), searchTerm))
                      : port.host_port}
                  </Badge>
                  <ExternalLink className="w-4 h-4 text-primary-600 dark:text-primary-400 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                {port.target && `Internal: ${port.target}`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Internal Port Indicator */}
          {shouldHighlight && port.target && port.target !== port.host_port.toString() && (
            <Badge variant="secondary" className="text-xs bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/50">
              Internal: {renderHighlightedText(highlightText(port.target, searchTerm))}
            </Badge>
          )}
        </div>

        {/* Service Details */}
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {shouldHighlight
                ? renderHighlightedText(highlightText(port.owner, searchTerm))
                : port.owner}
            </h4>
          </div>
          
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
            <Badge 
              variant={port.source === "docker" ? "default" : "secondary"}
              className={port.source === "docker" 
                ? "bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-200"
                : "bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-200"
              }
            >
              {port.source}
            </Badge>
            
            {port.created && (
              <Badge variant="outline" className="bg-slate-100 text-slate-500 dark:bg-slate-800/30 dark:text-slate-400">
                {formatDate(port.created)}
              </Badge>
            )}
            
            <span>
              {shouldHighlight
                ? renderHighlightedText(highlightText(hostForUi, searchTerm))
                : hostForUi}
            </span>
          </div>
          
          {port.note && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1 truncate" title={port.note}>
              {shouldHighlight
                ? renderHighlightedText(highlightText(port.note, searchTerm))
                : port.note}
            </p>
          )}
        </div>
      </div>

      {/* Actions (shown on hover) */}
      <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopy?.(port, protocol)}
            className="h-8 w-8 p-0"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit?.(port)}
            className="h-8 w-8 p-0"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleIgnore?.(port)}
            className="h-8 w-8 p-0"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}
```

#### StatusIndicator

Smart status indicator with health checking and protocol detection.

```tsx
interface StatusIndicatorProps {
  port: {
    host_port: string | number;
    host_ip: string;
  };
  serverId?: string;
  serverUrl?: string;
  onProtocolChange?: (protocol: string) => void;
  className?: string;
}

export function StatusIndicator({ 
  port, 
  serverId, 
  serverUrl, 
  onProtocolChange, 
  className 
}: StatusIndicatorProps) {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [protocol, setProtocol] = useState('http');

  useEffect(() => {
    const checkStatus = async () => {
      setStatus('checking');
      
      let hostForCheck = port.host_ip;
      if (port.host_ip === "0.0.0.0" || port.host_ip === "127.0.0.1") {
        if (serverId === "local") {
          hostForCheck = window.location.hostname;
        } else if (serverUrl) {
          try {
            hostForCheck = new URL(serverUrl).hostname;
          } catch {
            hostForCheck = "localhost";
          }
        } else {
          hostForCheck = "localhost";
        }
      }

      // Try HTTPS first, then HTTP
      for (const proto of ['https', 'http']) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const response = await fetch(`${proto}://${hostForCheck}:${port.host_port}`, {
            method: 'HEAD',
            signal: controller.signal,
            mode: 'no-cors',
          });
          
          clearTimeout(timeoutId);
          setStatus('online');
          setProtocol(proto);
          onProtocolChange?.(proto);
          return;
        } catch (error) {
          // Continue to next protocol
        }
      }
      
      setStatus('offline');
    };

    checkStatus();
  }, [port, serverId, serverUrl, onProtocolChange]);

  const statusConfig = {
    checking: {
      color: 'bg-yellow-500',
      icon: Loader2,
      iconClass: 'animate-spin text-yellow-600',
      tooltip: 'Checking status...'
    },
    online: {
      color: 'bg-green-500',
      icon: CheckCircle,
      iconClass: 'text-green-600',
      tooltip: `Online (${protocol.toUpperCase()})`
    },
    offline: {
      color: 'bg-red-500',
      icon: XCircle,
      iconClass: 'text-red-600',
      tooltip: 'Offline or unreachable'
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center space-x-2", className)}>
            <div className={`h-2 w-2 rounded-full ${config.color}`} />
            <Icon className={`h-4 w-4 ${config.iconClass}`} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {config.tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

#### SearchHighlighting Utility

Utility functions for search term highlighting across components.

```tsx
// Search highlighting utilities
export const getSearchMatches = (item: any, searchTerm: string) => {
  if (!searchTerm) return {};
  
  const term = searchTerm.toLowerCase();
  const matches: Record<string, boolean> = {};
  
  Object.keys(item).forEach(key => {
    const value = item[key];
    if (typeof value === 'string' && value.toLowerCase().includes(term)) {
      matches[key] = true;
    }
  });
  
  return matches;
};

export const highlightText = (text: string, searchTerm: string) => {
  if (!searchTerm || !text) return text;
  
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  const parts = text.split(regex);
  
  return {
    isHighlighted: true,
    parts: parts.map(part => ({
      text: part,
      highlighted: regex.test(part)
    }))
  };
};

// Component for rendering highlighted search results
interface HighlightedTextProps {
  text: string;
  searchTerm: string;
  className?: string;
}

export function HighlightedText({ text, searchTerm, className }: HighlightedTextProps) {
  if (!searchTerm) return <span className={className}>{text}</span>;
  
  const highlighted = highlightText(text, searchTerm);
  if (!highlighted.isHighlighted) return <span className={className}>{text}</span>;
  
  return (
    <span className={className}>
      {highlighted.parts.map((part, index) =>
        part.highlighted ? (
          <mark
            key={index}
            className="bg-yellow-200 dark:bg-yellow-800/50 text-yellow-900 dark:text-yellow-200 px-0.5 rounded"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  );
}
```

### Download Components

#### DownloadQueue

Queue management with real-time progress tracking.

```tsx
interface DownloadQueueProps {
  className?: string;
}

export function DownloadQueue({ className }: DownloadQueueProps) {
  const { activeJobs, queuedJobs, completedJobs } = useDownloadJobs();
  
  return (
    <div className={cn("space-y-6", className)}>
      {/* Active Downloads */}
      {activeJobs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Active Downloads</h2>
          <div className="space-y-2">
            {activeJobs.map((job) => (
              <DownloadJobCard key={job.id} job={job} variant="active" />
            ))}
          </div>
        </section>
      )}
      
      {/* Queued Downloads */}
      {queuedJobs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Queue</h2>
          <div className="space-y-2">
            {queuedJobs.map((job) => (
              <DownloadJobCard key={job.id} job={job} variant="queued" />
            ))}
          </div>
        </section>
      )}
      
      {/* Completed Downloads */}
      {completedJobs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Completed</h2>
          <div className="space-y-2">
            {completedJobs.slice(0, 10).map((job) => (
              <DownloadJobCard key={job.id} job={job} variant="completed" />
            ))}
          </div>
        </section>
      )}
      
      {/* Empty State */}
      {activeJobs.length === 0 && queuedJobs.length === 0 && completedJobs.length === 0 && (
        <div className="text-center py-12">
          <Download className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No downloads yet</h3>
          <p className="text-muted-foreground">
            Start by searching for content to download
          </p>
        </div>
      )}
    </div>
  );
}
```

#### DownloadJobCard

Individual download job display with progress and controls.

```tsx
interface DownloadJobCardProps {
  job: DownloadJob;
  variant: 'active' | 'queued' | 'completed' | 'failed';
  className?: string;
}

export function DownloadJobCard({ job, variant, className }: DownloadJobCardProps) {
  const { cancelJob } = useDownloadActions();
  
  const statusConfig = {
    active: {
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      icon: Download,
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    queued: {
      bgColor: 'bg-gray-50 dark:bg-gray-950/20',
      borderColor: 'border-gray-200 dark:border-gray-800',
      icon: Clock,
      iconColor: 'text-gray-600 dark:text-gray-400',
    },
    completed: {
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      borderColor: 'border-green-200 dark:border-green-800',
      icon: CheckCircle,
      iconColor: 'text-green-600 dark:text-green-400',
    },
    failed: {
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      borderColor: 'border-red-200 dark:border-red-800',
      icon: XCircle,
      iconColor: 'text-red-600 dark:text-red-400',
    },
  };
  
  const config = statusConfig[variant];
  const Icon = config.icon;
  
  return (
    <Card className={cn(
      config.bgColor,
      config.borderColor,
      "transition-all duration-200",
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <Icon className={cn("h-5 w-5 flex-shrink-0", config.iconColor)} />
            
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{job.content_title}</h3>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {job.service}
                </Badge>
                <span>•</span>
                <span>{formatDate(job.start_time)}</span>
                {job.end_time && (
                  <>
                    <span>•</span>
                    <span>{formatDuration(job.start_time, job.end_time)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Progress Information */}
            {variant === 'active' && job.progress !== undefined && (
              <div className="text-right">
                <div className="text-sm font-medium">{job.progress}%</div>
                {job.current_file && (
                  <div className="text-xs text-muted-foreground truncate max-w-32">
                    {job.current_file}
                  </div>
                )}
              </div>
            )}
            
            {/* Action Buttons */}
            {(variant === 'active' || variant === 'queued') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cancelJob(job.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            
            {variant === 'completed' && (
              <Button variant="ghost" size="sm">
                <FolderOpen className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Progress Bar */}
        {variant === 'active' && job.progress !== undefined && (
          <div className="mt-3">
            <Progress value={job.progress} className="h-2" />
          </div>
        )}
        
        {/* Error Display */}
        {variant === 'failed' && job.error && (
          <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
            {job.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Modal Components

#### DownloadOptionsModal

Advanced download configuration with quality and feature selection.

```tsx
interface DownloadOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: DownloadOptions) => void;
  result: EnhancedSearchResult;
}

export function DownloadOptionsModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  result 
}: DownloadOptionsModalProps) {
  const [options, setOptions] = useState<DownloadOptions>({
    quality: '1080p',
    hdr10: false,
    dolbyVision: false,
    atmos: false,
    subtitles: true,
    audioTracks: [],
  });
  
  const handleConfirm = () => {
    onConfirm(options);
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Download Options</DialogTitle>
          <DialogDescription>
            Configure quality and features for {result.displayTitle}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Content Preview */}
          <div className="flex space-x-3">
            {result.posterURL && (
              <img
                src={result.posterURL}
                alt={result.displayTitle}
                className="w-16 h-24 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <h3 className="font-medium">{result.displayTitle}</h3>
              <p className="text-sm text-muted-foreground">{result.displayYear}</p>
              <Badge variant="outline" className="mt-1">
                {result.unshackleResult.service}
              </Badge>
            </div>
          </div>
          
          {/* Quality Selection */}
          <div className="space-y-2">
            <Label>Resolution</Label>
            <Select value={options.quality} onValueChange={(value) => 
              setOptions(prev => ({ ...prev, quality: value as any }))
            }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720p">720p HD</SelectItem>
                <SelectItem value="1080p">1080p Full HD</SelectItem>
                <SelectItem value="4k">4K UHD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Advanced Features */}
          <div className="space-y-3">
            <Label>Advanced Features</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hdr10"
                  checked={options.hdr10}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, hdr10: !!checked }))
                  }
                />
                <Label htmlFor="hdr10" className="text-sm">HDR10</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dolbyVision"
                  checked={options.dolbyVision}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, dolbyVision: !!checked }))
                  }
                />
                <Label htmlFor="dolbyVision" className="text-sm">Dolby Vision</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="atmos"
                  checked={options.atmos}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, atmos: !!checked }))
                  }
                />
                <Label htmlFor="atmos" className="text-sm">Dolby Atmos</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="subtitles"
                  checked={options.subtitles}
                  onCheckedChange={(checked) =>
                    setOptions(prev => ({ ...prev, subtitles: !!checked }))
                  }
                />
                <Label htmlFor="subtitles" className="text-sm">Subtitles</Label>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Start Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## PortraTracker Design System Elements

### Logo Component

SVG-based logo with animation support and customizable styling.

```tsx
interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function Logo({ className, size = 'md', animated = false }: LogoProps) {
  const sizeConfig = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8', 
    lg: 'h-12 w-12'
  };

  return (
    <svg
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        sizeConfig[size],
        animated && 'transition-transform duration-300 ease-in-out hover:rotate-[15deg]',
        className
      )}
      aria-label="Unshackle Logo"
    >
      {/* Primary Path - Main Circle */}
      <path
        d="M15.3225 24.9499C17.5242 24.8682 19.6374 24.0618 21.3337 22.6557C23.03 21.2496 24.2144 19.3227 24.703 17.1743"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Connection Point */}
      <path
        d="M24.7891 13.1733L24.7823 13.1807"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Secondary Arc */}
      <path
        d="M23.2946 9.45791C22.43 8.14458 21.2678 7.05367 19.9024 6.27373C18.5371 5.4938 17.0071 5.04682 15.4366 4.9691C13.8661 4.89138 12.2994 5.18511 10.8637 5.82643C9.42804 6.46774 8.16382 7.43858 7.17371 8.66012C6.1836 9.88166 5.49551 11.3195 5.16529 12.8568C4.83507 14.3942 4.87204 15.9877 5.2732 17.5081C5.67435 19.0285 6.42838 20.4328 7.47407 21.6071C8.51976 22.7814 9.82763 23.6926 11.2915 24.2666"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Inner Ring */}
      <path
        d="M15.1741 20.9505C15.9899 20.9222 16.7912 20.7278 17.5292 20.3791C18.2672 20.0304 18.9263 19.5348 19.4662 18.9226C20.0061 18.3104 20.4153 17.5944 20.669 16.8186C20.9226 16.0428 21.0153 15.2234 20.9413 14.4105C20.8674 13.5976 20.6284 12.8084 20.2389 12.0911C19.8494 11.3738 19.3176 10.7435 18.6761 10.2387C18.0347 9.73401 17.297 9.36548 16.5081 9.1557C15.7193 8.94591 14.896 8.89927 14.0885 9.01864"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Central Element */}
      <path
        d="M13.4806 13.5985C12.7295 14.4084 12.7771 15.6738 13.5869 16.4249C14.3968 17.1761 15.6622 17.1285 16.4134 16.3187C17.1645 15.5088 17.1169 14.2434 16.3071 13.4922C15.4972 12.7411 14.2318 12.7887 13.4806 13.5985Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Connection Line */}
      <path
        d="M12.9953 14L11.4898 23.9999"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Additional Elements */}
      <path
        d="M9 18L8.99039 18.0028"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      <path
        d="M8.58898 14.5637C9.99346 8.99994 14.497 8.99985 13.9962 8.99984"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

### Validation Patterns

Real-time validation components with visual feedback and accessibility support.

```tsx
interface ValidationInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onValidate?: (value: string) => Promise<ValidationResult>;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

interface ValidationResult {
  isValid: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'loading';
}

export function ValidationInput({
  label,
  value,
  onChange,
  onValidate,
  placeholder,
  required,
  disabled,
  className
}: ValidationInputProps) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const latestValidationRef = useRef(0);

  useEffect(() => {
    if (!onValidate || !value.trim()) {
      setValidationResult(null);
      setIsValidating(false);
      return;
    }

    const validateValue = async () => {
      const currentValidation = ++latestValidationRef.current;
      setIsValidating(true);
      
      try {
        const result = await onValidate(value);
        
        if (currentValidation === latestValidationRef.current) {
          setValidationResult(result);
          setIsValidating(false);
        }
      } catch (error) {
        if (currentValidation === latestValidationRef.current) {
          setValidationResult({
            isValid: false,
            message: 'Validation failed',
            type: 'error'
          });
          setIsValidating(false);
        }
      }
    };

    const debounceTimer = setTimeout(validateValue, 800);
    return () => clearTimeout(debounceTimer);
  }, [value, onValidate]);

  const getInputStyles = () => {
    if (isValidating) return "border-blue-300 focus:border-blue-500";
    if (!validationResult) return "border-gray-300 dark:border-gray-700";
    
    switch (validationResult.type) {
      case 'success':
        return "border-green-500 focus:border-green-500";
      case 'error':
        return "border-red-300 focus:border-red-500";
      case 'warning':
        return "border-yellow-300 focus:border-yellow-500";
      default:
        return "border-gray-300 dark:border-gray-700";
    }
  };

  const getValidationIcon = () => {
    if (isValidating) {
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    }
    
    if (!validationResult) return null;
    
    switch (validationResult.type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={label} className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <div className="relative">
        <Input
          id={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pr-10", getInputStyles())}
          aria-describedby={validationResult ? `${label}-validation` : undefined}
        />
        
        {(isValidating || validationResult) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {getValidationIcon()}
          </div>
        )}
      </div>
      
      {/* Validation Status Message */}
      {validationResult && (
        <ValidationStatusMessage
          id={`${label}-validation`}
          result={validationResult}
        />
      )}
    </div>
  );
}

// Validation Status Message Component
interface ValidationStatusMessageProps {
  id: string;
  result: ValidationResult;
}

function ValidationStatusMessage({ id, result }: ValidationStatusMessageProps) {
  const getStatusStyles = () => {
    switch (result.type) {
      case 'success':
        return "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800";
      case 'error':
        return "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
      case 'warning':
        return "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
      case 'loading':
        return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      default:
        return "bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800";
    }
  };

  const getIcon = () => {
    switch (result.type) {
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <XCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4" />;
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div
      id={id}
      className={cn(
        "flex items-center space-x-2 p-2 rounded-md border text-sm",
        getStatusStyles()
      )}
      role="status"
      aria-live="polite"
    >
      {getIcon()}
      <span>{result.message}</span>
    </div>
  );
}
```

### Responsive Mobile Patterns

Mobile-first responsive patterns with touch-friendly interactions.

```tsx
// Mobile-first responsive hook
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  return isMobile;
}

// Mobile-optimized card component
interface MobileCardProps {
  children: React.ReactNode;
  onTap?: () => void;
  className?: string;
}

export function MobileCard({ children, onTap, className }: MobileCardProps) {
  const isMobile = useIsMobile();
  
  return (
    <div
      className={cn(
        "transition-all duration-200",
        isMobile 
          ? "active:scale-[0.98] active:bg-slate-100 dark:active:bg-slate-800" 
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
        onTap && "cursor-pointer",
        className
      )}
      onClick={onTap}
      role={onTap ? "button" : undefined}
      tabIndex={onTap ? 0 : undefined}
      onKeyDown={(e) => {
        if (onTap && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onTap();
        }
      }}
    >
      {children}
    </div>
  );
}

// Mobile dropdown menu pattern
interface MobileDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end';
}

export function MobileDropdown({ trigger, children, align = 'end' }: MobileDropdownProps) {
  const isMobile = useIsMobile();
  
  if (isMobile) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <div className="space-y-2">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Touch-friendly button sizing
export const touchButtonSizes = {
  sm: "h-9 px-3 text-sm", // Minimum 44px touch target
  default: "h-11 px-4", // 44px height for optimal touch
  lg: "h-12 px-6 text-lg", // Larger for primary actions
};

// Responsive grid utility
interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: number;
  className?: string;
}

export function ResponsiveGrid({ 
  children, 
  cols = { sm: 1, md: 2, lg: 3, xl: 4 }, 
  gap = 4,
  className 
}: ResponsiveGridProps) {
  const gridClasses = cn(
    "grid",
    `gap-${gap}`,
    cols.sm && `grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`,
    className
  );
  
  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
}
```

## Styling Patterns

### Responsive Design

```typescript
// Responsive breakpoints
const breakpoints = {
  sm: '640px',   // Small devices
  md: '768px',   // Medium devices
  lg: '1024px',  // Large devices
  xl: '1280px',  // Extra large devices
  '2xl': '1536px', // 2x Extra large devices
};

// Component responsive patterns
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
  {/* Content cards */}
</div>
```

### Dark Mode Support (PortraTracker Enhanced)

```typescript
// Enhanced dark mode with slate-based palette
<div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
  <Card className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
    {/* Content with improved contrast */}
  </Card>
</div>

// Status-aware dark mode colors
const statusColors = {
  success: {
    light: "bg-green-50 text-green-800 border-green-200",
    dark: "dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
  },
  error: {
    light: "bg-red-50 text-red-800 border-red-200", 
    dark: "dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
  },
  warning: {
    light: "bg-yellow-50 text-yellow-800 border-yellow-200",
    dark: "dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800"
  },
  info: {
    light: "bg-blue-50 text-blue-800 border-blue-200",
    dark: "dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
  }
};

// Dynamic theme-aware components
function ThemedCard({ variant = 'default', children, className }) {
  const baseClasses = "rounded-xl border transition-colors";
  const variantClasses = {
    default: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700",
    elevated: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md dark:hover:shadow-slate-900/20",
    success: `${statusColors.success.light} ${statusColors.success.dark}`,
    error: `${statusColors.error.light} ${statusColors.error.dark}`,
    warning: `${statusColors.warning.light} ${statusColors.warning.dark}`,
    info: `${statusColors.info.light} ${statusColors.info.dark}`
  };
  
  return (
    <div className={cn(baseClasses, variantClasses[variant], className)}>
      {children}
    </div>
  );
}
```

### Animation Patterns (PortraTracker Enhanced)

```typescript
// Smooth micro-interactions
<div className="transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-lg">
  {/* Subtle hover effects */}
</div>

// Mobile-friendly touch animations
<div className="transition-all duration-150 active:scale-[0.98] md:hover:scale-105">
  {/* Touch feedback for mobile, hover for desktop */}
</div>

// Advanced loading states with multiple elements
<div className="space-y-3">
  <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 rounded-md w-3/4" />
  <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-4 rounded-md w-1/2" />
  <div className="animate-pulse bg-slate-200 dark:bg-slate-700 h-8 rounded-lg w-24" />
</div>

// Staggered fade-in animations for lists
<div className="space-y-2">
  {items.map((item, index) => (
    <div 
      key={item.id}
      className="animate-in fade-in-0 slide-in-from-left-4 duration-300"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {item.content}
    </div>
  ))}
</div>

// Logo rotation animation (from PortraTracker)
<div className="transition-transform duration-300 ease-in-out group-hover:rotate-[30deg] group-focus:rotate-[30deg]">
  <Logo />
</div>

// Status indicator animations
const StatusDot = ({ status, animated = true }) => (
  <div 
    className={cn(
      "h-2 w-2 rounded-full transition-all duration-300",
      status === 'online' && "bg-green-500",
      status === 'offline' && "bg-red-500", 
      status === 'checking' && "bg-yellow-500",
      animated && status === 'checking' && "animate-pulse",
      animated && status === 'online' && "shadow-lg shadow-green-500/50"
    )}
  />
);

// Progress bar animation
<div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
  <div 
    className="bg-primary-500 h-1.5 rounded-full transition-all duration-500 ease-out"
    style={{ width: `${progress}%` }}
  />
</div>

// Search highlight animation
.search-highlight {
  @apply bg-yellow-200 dark:bg-yellow-800/50 text-yellow-900 dark:text-yellow-200 px-0.5 rounded;
  animation: highlight-flash 0.5s ease-in-out;
}

@keyframes highlight-flash {
  0%, 100% { background-opacity: 1; }
  50% { background-opacity: 0.7; }
}

// Card hover effects with smooth transitions
<Card className="group transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:shadow-sm">
  <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
    {/* Action buttons */}
  </div>
</Card>
```

### Accessibility Patterns (PortraTracker Enhanced)

```typescript
// Enhanced keyboard navigation with visual feedback
<Button
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAction();
    }
  }}
  className="focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
  aria-label="Download content"
  aria-describedby="download-help"
>
  Download
</Button>

// Comprehensive screen reader support
<div 
  role="status" 
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
>
  {loading && 'Loading content, please wait'}
  {error && `Error: ${error.message}`}
  {success && 'Operation completed successfully'}
</div>

// Advanced focus management with trap and restoration
function AccessibleModal({ isOpen, onClose, children }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    
    // Trap focus within modal
    if (e.key === 'Tab') {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements && focusableElements.length > 0) {
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
        
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="focus:outline-none"
    >
      {children}
    </div>
  );
}

// Accessible form validation with screen reader announcements
<ValidationInput
  label="Server URL"
  value={url}
  onChange={setUrl}
  aria-describedby="url-help url-validation"
  aria-invalid={validationResult?.type === 'error'}
  required
/>
<div id="url-help" className="text-sm text-slate-500 dark:text-slate-400">
  Enter the full URL including protocol (http:// or https://)
</div>

// Skip navigation links
<div className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50">
  <a 
    href="#main-content" 
    className="bg-primary-600 text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-white"
  >
    Skip to main content
  </a>
</div>

// Accessible search with live results announcement
function AccessibleSearch({ onSearch, results }) {
  const [announceResults, setAnnounceResults] = useState('');
  
  useEffect(() => {
    if (results.length > 0) {
      setAnnounceResults(`Found ${results.length} results`);
    } else {
      setAnnounceResults('No results found');
    }
  }, [results]);

  return (
    <div>
      <Input
        type="search"
        placeholder="Search..."
        onChange={(e) => onSearch(e.target.value)}
        aria-label="Search content"
        aria-describedby="search-results-count"
        className="focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
      
      <div 
        id="search-results-count"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announceResults}
      </div>
    </div>
  );
}

// High contrast mode support
.high-contrast {
  @media (prefers-contrast: high) {
    --primary-500: #0066cc;
    --border-color: #000000;
    --text-color: #000000;
    --background: #ffffff;
  }
}

// Reduced motion support
@media (prefers-reduced-motion: reduce) {
  .animate-spin,
  .animate-pulse,
  .transition-all,
  .transition-transform {
    animation: none !important;
    transition: none !important;
  }
}

// Touch target sizing for mobile accessibility
.touch-target {
  @apply min-h-[44px] min-w-[44px] flex items-center justify-center;
}

// Semantic landmarks and regions
<main role="main" aria-labelledby="page-title">
  <header role="banner">
    <nav role="navigation" aria-label="Main navigation">
      {/* Navigation items */}
    </nav>
  </header>
  
  <section role="region" aria-labelledby="content-heading">
    <h1 id="content-heading">Page Content</h1>
    {/* Main content */}
  </section>
  
  <aside role="complementary" aria-label="Related information">
    {/* Sidebar content */}
  </aside>
</main>
```

This component guide provides a comprehensive foundation for building consistent, accessible, and performant UI components in Unshackle UI.