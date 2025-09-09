'use client';

import { UnifiedSearchResult } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink, Star, Calendar, Globe, X } from 'lucide-react';
import Image from 'next/image';
import { ResultsTableSkeleton } from '@/components/skeletons/results-table-skeleton';

interface ResultsTableProps {
  results: UnifiedSearchResult[];
  onTitleClick?: (result: UnifiedSearchResult) => void;
  isLoading?: boolean;
  className?: string;
}

export function ResultsTable({
  results,
  onTitleClick,
  isLoading = false,
  className = '',
}: ResultsTableProps) {
  const router = useRouter();
  const [modalImage, setModalImage] = useState<{ url: string; title: string } | null>(null);
  if (isLoading) {
    return <ResultsTableSkeleton />;
  }

  if (results.length === 0) {
    return (
      <Card className="p-8">
        <CardContent>
          <div className="text-center text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No results found</p>
            <p className="text-sm">Try adjusting your search terms or filters</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getMediaTypeBadge = (mediaType: string) => {
    const type = mediaType.toLowerCase();
    if (type === 'movie') return { label: 'Movie', variant: 'default' as const };
    if (type === 'tv' || type === 'show')
      return { label: 'TV Show', variant: 'secondary' as const };
    return { label: mediaType, variant: 'outline' as const };
  };

  const formatRating = (rating: number) => {
    return rating.toFixed(1);
  };

  const formatVoteCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  const handleTitleInfo = (result: UnifiedSearchResult) => {
    // Store title data in session storage for the detail page
    const dataToStore = {
      ...result,
      // Ensure duplicate IDs are preserved
      _duplicateIds: (result as UnifiedSearchResult & { _duplicateIds?: string[] })._duplicateIds,
      _mergedFrom: (result as UnifiedSearchResult & { _mergedFrom?: string })._mergedFrom,
    };

    sessionStorage.setItem(`title-${result.id}`, JSON.stringify(dataToStore));

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] Storing title data for ${result.id}:`, {
        hasDuplicateIds: !!(result as UnifiedSearchResult & { _duplicateIds?: string[] })
          ._duplicateIds,
        duplicateIds: (result as UnifiedSearchResult & { _duplicateIds?: string[] })._duplicateIds,
        storedData: dataToStore,
      });
    }

    // Navigate to title detail page
    router.push(`/title/${result.id}`);

    // Also call the optional onTitleClick callback
    if (onTitleClick) {
      onTitleClick(result);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Poster</TableHead>
              <TableHead className="w-20">Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-20 text-center">Year</TableHead>
              <TableHead className="w-24 text-center">Rating</TableHead>
              <TableHead className="w-32">External Links</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result, index) => {
              const mediaTypeBadge = getMediaTypeBadge(result.mediaType);

              return (
                <TableRow key={`${result.source}-${result.id}-${index}`} className="h-[100px]">
                  <TableCell className="py-2">
                    {result.posterUrl ? (
                      <div className="flex justify-start">
                        <Image
                          src={result.posterUrl}
                          alt={result.title}
                          width={60}
                          height={90}
                          className="rounded-md object-cover shadow-sm border cursor-pointer hover:opacity-80 transition-opacity"
                          unoptimized
                          onClick={() =>
                            setModalImage({ url: result.posterUrl!, title: result.title })
                          }
                        />
                      </div>
                    ) : (
                      <div className="flex justify-start">
                        <div className="w-15 h-[90px] bg-muted rounded-md border flex items-center justify-center">
                          <Globe className="h-6 w-6 text-muted-foreground" />
                        </div>
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="align-middle">
                    <Badge variant={mediaTypeBadge.variant}>{mediaTypeBadge.label}</Badge>
                  </TableCell>

                  <TableCell className="font-medium align-middle">
                    <div className="space-y-1">
                      <div className="font-semibold">{result.title}</div>
                      {result.originalTitle && result.originalTitle !== result.title && (
                        <div className="text-sm text-muted-foreground">{result.originalTitle}</div>
                      )}
                      {result.overview && (
                        <div className="text-xs text-muted-foreground line-clamp-2 max-w-md">
                          {result.overview}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-center align-middle">
                    {result.releaseYear && (
                      <div className="flex items-center justify-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{result.releaseYear}</span>
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="text-center align-middle">
                    {result.rating && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-center space-x-1">
                          <Star className="h-3 w-3 text-yellow-500" />
                          <span className="font-medium">{formatRating(result.rating)}</span>
                        </div>
                        {result.voteCount && (
                          <div className="text-xs text-muted-foreground">
                            {formatVoteCount(result.voteCount)} votes
                          </div>
                        )}
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="align-middle">
                    <div className="flex flex-wrap gap-1">
                      {result.imdbId && (
                        <Button variant="outline" size="sm" asChild className="h-7 px-2">
                          <a
                            href={`https://www.imdb.com/title/${result.imdbId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1"
                          >
                            <span className="text-xs">IMDb</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}

                      {result.tmdbId && (
                        <Button variant="outline" size="sm" asChild className="h-7 px-2">
                          <a
                            href={`https://www.themoviedb.org/${result.mediaType === 'tv' ? 'tv' : 'movie'}/${result.tmdbId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1"
                          >
                            <span className="text-xs">TMDB</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}

                      {result.justWatchUrl && (
                        <Button variant="outline" size="sm" asChild className="h-7 px-2">
                          <a
                            href={result.justWatchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1"
                          >
                            <span className="text-xs">JustWatch</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="align-middle">
                    <div className="flex space-x-1">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleTitleInfo(result)}
                        className="h-7 px-2"
                      >
                        <span className="text-xs">Info</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        Showing {results.length} results from multiple sources
      </div>

      {/* Full-size poster modal */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setModalImage(null)}
        >
          <div className="relative max-w-2xl max-h-[90vh]">
            <Button
              variant="ghost"
              size="sm"
              className="absolute -top-12 right-0 text-white hover:text-gray-300"
              onClick={() => setModalImage(null)}
            >
              <X className="h-6 w-6" />
            </Button>
            <Image
              src={modalImage.url}
              alt={modalImage.title}
              width={500}
              height={750}
              className="rounded-lg object-contain max-w-full max-h-full"
              unoptimized
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
