import { Layout, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type EnhancedSearchResult } from '@/lib/types';
import { ContentGrid } from './content-grid';
import { SearchResultsSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState, EmptyState } from '@/components/ui/error-state';

interface SearchResultsProps {
  results: EnhancedSearchResult[];
  loading: boolean;
  error?: Error | null;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onDownload: (result: EnhancedSearchResult) => void;
  onRetry?: () => void;
  searchQuery?: string;
  className?: string;
}

export function SearchResults({
  results,
  loading,
  error,
  viewMode,
  onViewModeChange,
  onDownload,
  onRetry,
  searchQuery,
  className
}: SearchResultsProps) {
  // Error state
  if (error) {
    return (
      <div className={cn('py-8', className)}>
        <ErrorState
          type="search"
          title="Search failed"
          description={error.message || "Unable to search at this time. Please try again."}
          onRetry={onRetry}
        />
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
          </div>
          <div className="flex space-x-2">
            <div className="h-9 w-9 bg-muted animate-pulse rounded" />
            <div className="h-9 w-9 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <SearchResultsSkeleton viewMode={viewMode} count={12} />
      </div>
    );
  }

  // Empty state
  if (results.length === 0 && !loading) {
    return (
      <div className={cn('py-8', className)}>
        <EmptyState
          title="No results found"
          description={
            searchQuery 
              ? `No content found for "${searchQuery}". Try adjusting your search terms or selecting different services.`
              : "Start by searching for movies, shows, or music using the search bar above."
          }
        />
      </div>
    );
  }

  // Results with controls
  return (
    <div className={cn('space-y-6', className)}>
      {/* Results header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">
            Search Results
          </h2>
          <Badge variant="secondary" className="text-xs">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('list')}
          >
            <Layout className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Results grid/list */}
      <ContentGrid
        results={results}
        onDownload={onDownload}
        viewMode={viewMode}
      />
    </div>
  );
}