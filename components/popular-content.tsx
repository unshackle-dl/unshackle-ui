'use client';

import { useState, useEffect } from 'react';
import { PopularContentResponse } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, Film, Tv, Star, ExternalLink, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PopularContentProps {
  country?: string;
}

export function PopularContent({ country = 'US' }: PopularContentProps) {
  const router = useRouter();
  const [data, setData] = useState<PopularContentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleTitleClick = (titleId: string) => {
    router.push(`/title/${titleId}`);
  };

  useEffect(() => {
    const fetchPopularContent = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ country });
        const response = await fetch(`/api/popular?${params}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch popular content: ${response.statusText}`);
        }

        const result: PopularContentResponse = await response.json();
        setData(result);
      } catch (err) {
        console.error('Popular content error:', err);
        setError(
          err instanceof Error ? err.message : 'An error occurred while loading popular content'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchPopularContent();
  }, [country]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Film className="h-4 w-4" />
                <span className="font-medium">Popular Movies</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-muted rounded-md h-64 w-full mb-2"></div>
                    <div className="bg-muted rounded h-4 w-3/4 mb-1"></div>
                    <div className="bg-muted rounded h-3 w-1/2"></div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex items-center space-x-2">
                <Tv className="h-4 w-4" />
                <span className="font-medium">Popular TV Shows</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-muted rounded-md h-64 w-full mb-2"></div>
                    <div className="bg-muted rounded h-4 w-3/4 mb-1"></div>
                    <div className="bg-muted rounded h-3 w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data || (data.movies.length === 0 && data.tvShows.length === 0)) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No popular content available at the moment.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-6">
            {/* Popular Movies */}
            {data.movies.length > 0 && (
              <>
                <div className="flex items-center space-x-2">
                  <Film className="h-4 w-4" />
                  <span className="font-medium">Popular Movies</span>
                  <Badge variant="secondary">{data.totalMovies}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {data.movies.map(movie => (
                    <div key={movie.id} className="group">
                      <div
                        className="relative aspect-[2/3] rounded-md overflow-hidden bg-muted mb-2 cursor-pointer"
                        onClick={() => handleTitleClick(movie.id)}
                      >
                        {movie.posterUrl ? (
                          <img
                            src={movie.posterUrl}
                            alt={movie.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={e => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div
                          className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20"
                          style={{ display: movie.posterUrl ? 'none' : 'flex' }}
                        >
                          <div className="text-center space-y-2">
                            <Film className="h-12 w-12 text-muted-foreground mx-auto" />
                            <p className="text-xs text-muted-foreground px-2 leading-tight">
                              {movie.title}
                            </p>
                          </div>
                        </div>
                        {movie.rating && (
                          <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded flex items-center space-x-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span>{movie.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm line-clamp-2 leading-tight">
                          {movie.title}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{movie.releaseYear || 'N/A'}</span>
                          {movie.justWatchUrl && (
                            <Link
                              href={movie.justWatchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3 hover:text-foreground" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {data.movies.length > 0 && data.tvShows.length > 0 && <Separator />}

            {/* Popular TV Shows */}
            {data.tvShows.length > 0 && (
              <>
                <div className="flex items-center space-x-2">
                  <Tv className="h-4 w-4" />
                  <span className="font-medium">Popular TV Shows</span>
                  <Badge variant="secondary">{data.totalTvShows}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {data.tvShows.map(show => (
                    <div key={show.id} className="group">
                      <div
                        className="relative aspect-[2/3] rounded-md overflow-hidden bg-muted mb-2 cursor-pointer"
                        onClick={() => handleTitleClick(show.id)}
                      >
                        {show.posterUrl ? (
                          <img
                            src={show.posterUrl}
                            alt={show.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={e => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div
                          className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20"
                          style={{ display: show.posterUrl ? 'none' : 'flex' }}
                        >
                          <div className="text-center space-y-2">
                            <Tv className="h-12 w-12 text-muted-foreground mx-auto" />
                            <p className="text-xs text-muted-foreground px-2 leading-tight">
                              {show.title}
                            </p>
                          </div>
                        </div>
                        {show.rating && (
                          <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded flex items-center space-x-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span>{show.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-medium text-sm line-clamp-2 leading-tight">
                          {show.title}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{show.releaseYear || 'N/A'}</span>
                          {show.justWatchUrl && (
                            <Link
                              href={show.justWatchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3 hover:text-foreground" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Show errors if any */}
      {Object.keys(data.errors).length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Some sources encountered errors:{' '}
            {Object.entries(data.errors).map(([source, error]) => (
              <span key={source} className="block text-xs">
                {source}: {error}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
