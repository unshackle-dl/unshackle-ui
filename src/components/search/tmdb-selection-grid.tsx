import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Calendar, Star, Film, Tv } from 'lucide-react';
import type { TMDBSearchResult } from '@/lib/types';

interface TMDBSelectionGridProps {
  results: TMDBSearchResult[];
  isLoading: boolean;
  onSelect: (result: TMDBSearchResult) => void;
  onRetry: () => void;
}

export function TMDBSelectionGrid({ results, isLoading, onSelect, onRetry }: TMDBSelectionGridProps) {
  const getTitle = (result: TMDBSearchResult) => {
    return result.title || result.name || result.original_title || result.original_name || 'Unknown Title';
  };

  const getReleaseYear = (result: TMDBSearchResult) => {
    const date = result.release_date || result.first_air_date;
    return date ? new Date(date).getFullYear() : null;
  };

  const getMediaTypeIcon = (mediaType: string) => {
    switch (mediaType) {
      case 'movie':
        return <Film className="h-3 w-3" />;
      case 'tv':
        return <Tv className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getPosterUrl = (posterPath?: string) => {
    if (!posterPath) return null;
    return `https://image.tmdb.org/t/p/w200${posterPath}`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="aspect-[3/4] bg-muted animate-pulse">
            <CardContent className="p-4 h-full flex items-center justify-center">
              <Spinner className="h-6 w-6" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">No results found. Try a different search term.</p>
        <Button onClick={onRetry} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  // Show up to 6 results in a 3x2 grid
  const displayResults = results.slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-lg font-semibold">Select the correct title</h3>
        <p className="text-sm text-muted-foreground">Choose from the results below to search streaming services</p>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        {displayResults.map((result) => {
          const title = getTitle(result);
          const year = getReleaseYear(result);
          const posterUrl = getPosterUrl(result.poster_path);

          return (
            <Card 
              key={result.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow aspect-[3/4] overflow-hidden"
              onClick={() => onSelect(result)}
            >
              <div className="relative h-full">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={title}
                    className="w-full h-2/3 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-2/3 bg-muted flex items-center justify-center">
                    {getMediaTypeIcon(result.media_type)}
                  </div>
                )}
                
                <CardContent className="p-3 h-1/3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h4 className="font-medium text-sm leading-tight line-clamp-2" title={title}>
                      {title}
                    </h4>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      {year && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>{year}</span>
                        </div>
                      )}
                      
                      {result.vote_average > 0 && (
                        <div className="flex items-center space-x-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span>{result.vote_average.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="outline" className="text-xs">
                      {result.media_type === 'movie' ? 'Movie' : 'TV Show'}
                    </Badge>
                  </div>
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>
      
      {results.length > 6 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing first 6 results. Try a more specific search for better results.
        </p>
      )}
    </div>
  );
}