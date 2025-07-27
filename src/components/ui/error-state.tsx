import { AlertTriangle, RefreshCw, Search, Wifi } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  type?: 'generic' | 'network' | 'search' | 'not-found';
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

const errorConfig = {
  generic: {
    icon: AlertTriangle,
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again.',
  },
  network: {
    icon: Wifi,
    title: 'Connection error',
    description: 'Unable to connect to the server. Please check your connection.',
  },
  search: {
    icon: Search,
    title: 'Search failed',
    description: 'Unable to search at this time. Please try again.',
  },
  'not-found': {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search terms or selecting different services.',
  },
};

export function ErrorState({
  type = 'generic',
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
  className
}: ErrorStateProps) {
  const config = errorConfig[type];
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center py-12 px-4',
      className
    )}>
      <Icon className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">
        {title || config.title}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        {description || config.description}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Search,
  className
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center py-12 px-4',
      className
    )}>
      <Icon className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-6 max-w-md">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}