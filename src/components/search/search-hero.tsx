import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type ServiceInfo } from '@/lib/types';
import { useSearchStore } from '@/stores/search-store';
import { ServiceSelector } from './service-selector';
import { SearchFilters } from './search-filters';

type ContentType = 'movie' | 'tv' | 'music';

interface SearchHeroProps {
  onSearch: (query: string) => void;
  onServiceChange: (services: string[]) => void;
  services: ServiceInfo[];
  selectedServices: string[];
  servicesLoading?: boolean;
  className?: string;
}

export function SearchHero({ 
  onSearch, 
  onServiceChange, 
  services,
  selectedServices,
  servicesLoading = false,
  className 
}: SearchHeroProps) {
  const [query, setQuery] = useState('');
  const [selectedContentTypes, setSelectedContentTypes] = useState<ContentType[]>(['movie', 'tv']);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  
  const { searchHistory, clearSearchHistory } = useSearchStore();
  
  const handleSearch = useCallback(() => {
    if (query.trim()) {
      onSearch(query.trim());
      setShowHistory(false);
    }
  }, [query, onSearch]);

  const handleHistorySelect = useCallback((historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false);
    onSearch(historyQuery);
  }, [onSearch]);

  // Close history dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        historyRef.current && 
        !historyRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleServiceToggle = useCallback((serviceId: string) => {
    const updated = selectedServices.includes(serviceId)
      ? selectedServices.filter(id => id !== serviceId)
      : [...selectedServices, serviceId];
    onServiceChange(updated);
  }, [selectedServices, onServiceChange]);

  const handleContentTypeToggle = useCallback((type: ContentType) => {
    setSelectedContentTypes(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  }, []);
  
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
        <div className="relative">
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                placeholder="Search for movies, shows, music..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  } else if (e.key === 'ArrowDown' && searchHistory.length > 0) {
                    setShowHistory(true);
                  }
                }}
                onFocus={() => {
                  if (searchHistory.length > 0) {
                    setShowHistory(true);
                  }
                }}
                className="flex-1"
              />
              
              {/* Search History Dropdown */}
              {showHistory && searchHistory.length > 0 && (
                <div ref={historyRef} className="absolute top-full left-0 right-0 z-50 mt-1">
                  <Card>
                    <CardContent className="p-2">
                      <div className="flex items-center justify-between mb-2 px-2">
                        <span className="text-xs font-medium text-muted-foreground">Recent Searches</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            clearSearchHistory();
                            setShowHistory(false);
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-1">
                        {searchHistory.slice(0, 5).map((item, index) => (
                          <button
                            key={index}
                            onClick={() => handleHistorySelect(item.query)}
                            className="w-full flex items-center space-x-2 px-2 py-1.5 text-sm text-left hover:bg-muted rounded-md transition-colors"
                          >
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="flex-1 truncate">{item.query}</span>
                            <span className="text-xs text-muted-foreground">
                              {item.resultCount} results
                            </span>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
            <Button onClick={handleSearch} disabled={!query.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4">
          <ServiceSelector
            services={services}
            selected={selectedServices}
            onToggle={handleServiceToggle}
            loading={servicesLoading}
          />
          <SearchFilters
            selectedTypes={selectedContentTypes}
            onTypeToggle={handleContentTypeToggle}
          />
        </div>
      </div>
    </div>
  );
}