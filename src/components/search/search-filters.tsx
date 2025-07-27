import { Film, Monitor, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type ContentType = 'movie' | 'tv' | 'music';

interface SearchFiltersProps {
  selectedTypes: ContentType[];
  onTypeToggle: (type: ContentType) => void;
  className?: string;
}

const contentTypes: { type: ContentType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'movie', label: 'Movies', icon: Film },
  { type: 'tv', label: 'TV Shows', icon: Monitor },
  { type: 'music', label: 'Music', icon: Music },
];

export function SearchFilters({ selectedTypes, onTypeToggle, className }: SearchFiltersProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <Label className="text-sm font-medium">Content Type</Label>
      <div className="flex flex-wrap gap-2">
        {contentTypes.map(({ type, label, icon: Icon }) => (
          <Button
            key={type}
            variant={selectedTypes.includes(type) ? 'default' : 'outline'}
            size="sm"
            onClick={() => onTypeToggle(type)}
            className="flex items-center space-x-2"
          >
            <Icon className="h-3 w-3" />
            <span>{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}