import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
    />
  );
}

interface ContentCardSkeletonProps {
  className?: string;
}

export function ContentCardSkeleton({ className }: ContentCardSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <Skeleton className="aspect-[2/3] w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[60%]" />
      </div>
    </div>
  );
}

interface SearchResultsSkeletonProps {
  count?: number;
  viewMode?: 'grid' | 'list';
  className?: string;
}

export function SearchResultsSkeleton({ 
  count = 12, 
  viewMode = 'grid',
  className 
}: SearchResultsSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (viewMode === 'list') {
    return (
      <div className={cn('space-y-4', className)}>
        {items.map((i) => (
          <div key={i} className="flex space-x-4">
            <Skeleton className="h-24 w-16 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(
      'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4',
      className
    )}>
      {items.map((i) => (
        <ContentCardSkeleton key={i} />
      ))}
    </div>
  );
}