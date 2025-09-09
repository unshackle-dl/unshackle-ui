'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TitleDetail } from '@/components/title-detail';
import { UnifiedSearchResult } from '@/lib/types';
import { TitleDetailSkeleton } from '@/components/skeletons/title-detail-skeleton';
import { ThemeToggle } from '@/components/theme-toggle';

export default function TitlePage() {
  const params = useParams();
  const router = useRouter();
  const [titleData, setTitleData] = useState<UnifiedSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTitleData = async () => {
      if (!params.id) return;

      try {
        setIsLoading(true);
        setError(null);

        // Get title data from URL params or session storage
        const storedTitle = sessionStorage.getItem(`title-${params.id}`);
        if (storedTitle) {
          const parsedTitle = JSON.parse(storedTitle);
          if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] Found stored title data:`, {
              id: parsedTitle.id,
              title: parsedTitle.title,
              hasDuplicateIds: !!parsedTitle._duplicateIds,
              duplicateIds: parsedTitle._duplicateIds,
            });
          }
          setTitleData(parsedTitle);
          setIsLoading(false);
          return;
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(`[DEBUG] No stored title data found for ID: ${params.id}, fetching from API`);
        }

        // If no stored data, try to fetch from API
        const response = await fetch(`/api/title/${params.id}?source=JustWatch`);
        if (!response.ok) {
          throw new Error('Failed to fetch title details');
        }

        const data = await response.json();

        // Convert API response to UnifiedSearchResult format
        const titleResult: UnifiedSearchResult = {
          id: params.id as string,
          source: 'JustWatch',
          title: data.title?.content?.title || 'Unknown Title',
          overview: data.title?.content?.shortDescription,
          releaseYear: data.title?.content?.originalReleaseYear,
          releaseDate: data.title?.content?.originalReleaseDate,
          mediaType: data.title?.objectType?.toLowerCase() === 'show' ? 'tv' : 'movie',
          posterUrl: data.title?.content?.posterUrl?.startsWith('/')
            ? `https://images.justwatch.com${data.title.content.posterUrl}`
            : data.title?.content?.posterUrl,
          genres: data.title?.content?.genres?.map((g: { shortName: string }) => g.shortName) || [],
          imdbId: data.title?.content?.externalIds?.imdbId,
          tmdbId: data.title?.content?.externalIds?.tmdbId,
          runtime: data.title?.content?.runtime,
          justWatchUrl: data.title?.content?.fullPath
            ? `https://justwatch.com${data.title.content.fullPath}`
            : undefined,
          countries: data.title?.content?.productionCountries || [],
        };

        setTitleData(titleResult);
      } catch (err) {
        console.error('Error fetching title data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load title');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTitleData();
  }, [params.id]);

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="relative">
            <div className="absolute top-0 right-0">
              <ThemeToggle />
            </div>
            <TitleDetailSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error || !titleData) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="relative">
            <div className="absolute top-0 right-0">
              <ThemeToggle />
            </div>
            <div className="text-center py-16">
              <h2 className="text-2xl font-semibold mb-2">Title Not Found</h2>
              <p className="text-muted-foreground mb-4">
                {error || 'The requested title could not be found.'}
              </p>
              <button
                onClick={handleBack}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="relative">
          <div className="absolute top-0 right-0 z-10">
            <ThemeToggle />
          </div>
          <TitleDetail result={titleData} onBack={handleBack} />
        </div>
      </div>
    </div>
  );
}
