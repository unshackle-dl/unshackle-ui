import { useState } from 'react';
import { Download, Film, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type EnhancedSearchResult } from '@/lib/types';

interface ContentCardProps {
  result: EnhancedSearchResult;
  onDownload: (result: EnhancedSearchResult) => void;
  className?: string;
}

export function ContentCard({ result, onDownload, className }: ContentCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload(result);
    } finally {
      setIsDownloading(false);
    }
  };
  
  return (
    <Card className={cn("group relative overflow-hidden", className)}>
      <div className="aspect-[2/3] relative rounded-xl overflow-hidden">
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
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
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