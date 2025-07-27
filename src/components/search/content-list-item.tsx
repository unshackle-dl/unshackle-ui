import { useState } from 'react';
import { Download, Film, Star, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type EnhancedSearchResult } from '@/lib/types';

interface ContentListItemProps {
  result: EnhancedSearchResult;
  onDownload: (result: EnhancedSearchResult) => void;
  className?: string;
}

export function ContentListItem({ result, onDownload, className }: ContentListItemProps) {
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
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-4">
        <div className="flex space-x-4">
          {/* Poster Thumbnail */}
          <div className="w-16 h-24 flex-shrink-0 relative overflow-hidden rounded">
            {result.posterURL && !imageError ? (
              <img
                src={result.posterURL}
                alt={result.displayTitle}
                className={cn(
                  "w-full h-full object-cover",
                  imageLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Film className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 bg-muted animate-pulse" />
            )}
          </div>
          
          {/* Content Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg leading-tight truncate">
                  {result.displayTitle}
                </h3>
                
                <div className="flex items-center space-x-3 mt-1 text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span>{result.displayYear}</span>
                  </div>
                  
                  {result.rating && (
                    <div className="flex items-center space-x-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>{result.rating.toFixed(1)}</span>
                    </div>
                  )}
                  
                  <Badge variant="outline" className="text-xs">
                    {result.unshackleResult.service}
                  </Badge>
                </div>
                
                {result.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {result.description}
                  </p>
                )}
                
                {result.genres && result.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.genres.slice(0, 3).map((genre) => (
                      <Badge key={genre} variant="secondary" className="text-xs">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Download Button */}
              <div className="ml-4 flex-shrink-0">
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="min-w-[100px]"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Downloading
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}