import { NextRequest, NextResponse } from 'next/server';
import { PopularContentResponse, UnifiedSearchResult, ApiError } from '@/lib/types';
import { justWatchService } from '@/lib/services/justwatch';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const country = searchParams.get('country') || 'US';

    const response: PopularContentResponse = {
      movies: [],
      tvShows: [],
      totalMovies: 0,
      totalTvShows: 0,
      sources: [],
      errors: {} as Record<string, string>,
    };

    // Get popular content from JustWatch with better caching
    try {
      response.sources.push('JustWatch');

      // Get more popular titles from JustWatch to ensure we have enough movies and TV shows
      const justWatchResponse = await justWatchService.getPopularTitles(country, 50);
      if (justWatchResponse.data?.popularTitles?.edges) {
        // Separate movies and TV shows
        const allTitles = justWatchResponse.data.popularTitles.edges.map(edge => edge.node);
        const movies = allTitles.filter(node => node.objectType === 'MOVIE').slice(0, 5);
        const tvShows = allTitles.filter(node => node.objectType === 'SHOW').slice(0, 5);

        // Process movies
        for (const node of movies) {
          // Convert relative poster URLs to full JustWatch CDN URLs
          let justWatchPosterUrl = node.content.posterUrl;
          if (justWatchPosterUrl && justWatchPosterUrl.startsWith('/')) {
            justWatchPosterUrl = `https://images.justwatch.com${justWatchPosterUrl}`;
          }

          const result: UnifiedSearchResult = {
            id: node.id,
            source: 'JustWatch' as const,
            title: node.content.title,
            releaseYear: node.content.originalReleaseYear,
            mediaType: 'movie',
            posterUrl: justWatchPosterUrl, // Use JustWatch poster as default
            genres: node.content.genres?.map(g => g.shortName) || [],
            countries: node.content.productionCountries || [],
            imdbId: node.content.externalIds?.imdbId,
            tmdbId: node.content.externalIds?.tmdbId,
            justWatchUrl: node.content.fullPath
              ? `https://justwatch.com${node.content.fullPath}`
              : undefined,
            runtime: node.content.runtime,
          };

          // JustWatch posters are used as primary source - no need for additional API calls

          response.movies.push(result);
        }
        response.totalMovies = response.movies.length;

        // Process TV shows
        for (const node of tvShows) {
          // Convert relative poster URLs to full JustWatch CDN URLs
          let justWatchPosterUrl = node.content.posterUrl;
          if (justWatchPosterUrl && justWatchPosterUrl.startsWith('/')) {
            justWatchPosterUrl = `https://images.justwatch.com${justWatchPosterUrl}`;
          }

          const result: UnifiedSearchResult = {
            id: node.id,
            source: 'JustWatch' as const,
            title: node.content.title,
            releaseYear: node.content.originalReleaseYear,
            mediaType: 'tv',
            posterUrl: justWatchPosterUrl, // Use JustWatch poster as default
            genres: node.content.genres?.map(g => g.shortName) || [],
            countries: node.content.productionCountries || [],
            imdbId: node.content.externalIds?.imdbId,
            tmdbId: node.content.externalIds?.tmdbId,
            justWatchUrl: node.content.fullPath
              ? `https://justwatch.com${node.content.fullPath}`
              : undefined,
            runtime: node.content.runtime,
          };

          // JustWatch posters are used as primary source - no need for additional API calls

          response.tvShows.push(result);
        }
        response.totalTvShows = response.tvShows.length;
      }
    } catch (error) {
      console.error('JustWatch popular content error:', error);
      response.errors.JustWatch =
        error instanceof ApiError ? error.message : 'Failed to fetch popular content';
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Popular content API error:', error);
    return NextResponse.json({ error: 'Failed to fetch popular content' }, { status: 500 });
  }
}
