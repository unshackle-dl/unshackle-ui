import { cn } from '@/lib/utils';
import { type EnhancedSearchResult } from '@/lib/types';
import { ContentCard } from './content-card';
import { ContentListItem } from './content-list-item';

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