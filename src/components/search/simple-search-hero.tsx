import { useState, useCallback, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SimpleSearchHeroProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}

export function SimpleSearchHero({ 
  onSearch, 
  isLoading = false,
  disabled = false,
  placeholder = "Search for movies and TV shows...",
  defaultValue = "",
  className 
}: SimpleSearchHeroProps) {
  const [query, setQuery] = useState(defaultValue);
  
  // Update query when defaultValue changes
  useEffect(() => {
    setQuery(defaultValue);
  }, [defaultValue]);

  const handleSearch = useCallback(() => {
    if (query.trim() && !disabled && !isLoading) {
      onSearch(query.trim());
    }
  }, [query, onSearch, disabled, isLoading]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);
  
  return (
    <div className={cn("space-y-6", className)}>
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Search Movies & TV Shows
        </h1>
        <p className="text-muted-foreground">
          Find content from TMDB, then search streaming services
        </p>
      </div>
      
      <div className="max-w-2xl mx-auto">
        <div className="flex space-x-2">
          <Input
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="flex-1"
          />
          <Button 
            onClick={handleSearch} 
            disabled={!query.trim() || disabled || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Search
          </Button>
        </div>
      </div>
    </div>
  );
}