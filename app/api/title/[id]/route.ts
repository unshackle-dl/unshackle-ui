import { NextRequest, NextResponse } from 'next/server';
import { justWatchService } from '@/lib/services/justwatch';
import { tmdbService } from '@/lib/services/tmdb';
import { simklService } from '@/lib/services/simkl';
import { ApiSource } from '@/lib/types';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const source = (searchParams.get('source') as ApiSource) || 'JustWatch';
    const country = searchParams.get('country') || 'US';

    if (!id) {
      return NextResponse.json({ error: 'Title ID is required' }, { status: 400 });
    }

    console.log(`Fetching title details: ${id} from ${source}`);

    let titleData;
    let offers;

    switch (source) {
      case 'JustWatch':
        // Check if this is a merged result with duplicate IDs
        const duplicateIdsParam = searchParams.get('duplicateIds');
        const duplicateIds = duplicateIdsParam ? duplicateIdsParam.split(',') : [id];

        if (process.env.NODE_ENV === 'development') {
          console.log(`[DEBUG] Raw duplicateIds param: "${duplicateIdsParam}"`);
          console.log(`[DEBUG] Fetching JustWatch data for IDs: [${duplicateIds.join(', ')}]`);
          console.log(`[DEBUG] Will fetch data for ${duplicateIds.length} ID(s)`);
        }

        // Fetch data from all duplicate IDs and merge
        const titlePromises = duplicateIds.map(titleId =>
          justWatchService.getTitleNode(titleId, country)
        );

        const titleResponses = await Promise.allSettled(titlePromises);
        const validTitleData = titleResponses
          .filter(result => result.status === 'fulfilled' && !!result.value?.data?.node)
          .map(
            result =>
              (result as PromiseFulfilledResult<{ data: { node: unknown } }>).value.data.node
          );

        if (validTitleData.length === 0) {
          return NextResponse.json({ error: 'Title not found' }, { status: 404 });
        }

        // Use the first valid result as base, but merge external IDs
        titleData = validTitleData[0] as any;

        // Merge external IDs from all duplicates
        if (validTitleData.length > 1) {
          const mergedExternalIds = { ...(titleData as any).content?.externalIds };
          validTitleData.forEach(data => {
            const extIds = (data as any).content?.externalIds;
            if (extIds) {
              if (!mergedExternalIds.imdbId && extIds.imdbId)
                mergedExternalIds.imdbId = extIds.imdbId;
              if (!mergedExternalIds.tmdbId && extIds.tmdbId)
                mergedExternalIds.tmdbId = extIds.tmdbId;
            }
          });

          if ((titleData as any).content) {
            (titleData as any).content.externalIds = mergedExternalIds;
          }
        }

        // Fetch offers for all duplicate IDs and all major countries
        const countries = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT'];
        const allOffers: Record<string, unknown[]> = {};

        try {
          const offerPromises = duplicateIds.map(titleId =>
            justWatchService.getTitleOffers(titleId, countries)
          );

          const offerResponses = await Promise.allSettled(offerPromises);

          offerResponses.forEach((result, index) => {
            const titleId = duplicateIds[index];

            if (result.status === 'fulfilled' && result.value?.data?.node) {
              const nodeOffers = result.value.data.node;

              if (process.env.NODE_ENV === 'development') {
                console.log(`[DEBUG] Processing offers for ${titleId}:`, {
                  hasNode: !!nodeOffers,
                  nodeKeys: Object.keys(nodeOffers || {}),
                  sampleCountry: nodeOffers?.us
                    ? `US has ${nodeOffers.us.length} offers`
                    : 'No US offers',
                });
              }

              // Merge offers by country - check both formats
              countries.forEach(country => {
                // Using lowercase field names (matching .NET implementation)
                const countryOffers = nodeOffers[country.toLowerCase()];
                if (countryOffers && countryOffers.length > 0) {
                  if (!allOffers[country]) {
                    allOffers[country] = [];
                  }
                  allOffers[country].push(...countryOffers);
                }
              });
            } else if (result.status === 'rejected') {
              console.warn(`Failed to fetch offers for ${titleId}:`, result.reason);
            }
          });

          // Remove duplicate offers within each country
          Object.keys(allOffers).forEach(country => {
            const uniqueOffers = new Map();
            allOffers[country].forEach(offer => {
              const key = `${(offer as any).package?.clearName}-${(offer as any).monetizationType}`;
              if (
                !uniqueOffers.has(key) ||
                (offer as any).retailPriceValue < uniqueOffers.get(key).retailPriceValue
              ) {
                uniqueOffers.set(key, offer);
              }
            });
            allOffers[country] = Array.from(uniqueOffers.values());
          });

          offers = allOffers;

          if (process.env.NODE_ENV === 'development') {
            const totalOffers = Object.values(allOffers).reduce((sum, arr) => sum + arr.length, 0);
            console.log(
              `[DEBUG] Merged ${totalOffers} offers from ${duplicateIds.length} duplicates across ${Object.keys(allOffers).length} countries`
            );
          }
        } catch (error) {
          console.warn('Failed to fetch offers:', error);
          offers = {};
        }
        break;

      case 'Tmdb':
        const tmdbId = parseInt(id);
        if (isNaN(tmdbId)) {
          return NextResponse.json({ error: 'Invalid TMDB ID' }, { status: 400 });
        }

        if (!tmdbService.isConfigured()) {
          return NextResponse.json({ error: 'TMDB API key is not configured' }, { status: 503 });
        }

        // Try to fetch as movie first, then as TV show
        titleData = await tmdbService.getMovieDetails(tmdbId);
        if (!titleData) {
          titleData = await tmdbService.getTvDetails(tmdbId);
        }

        if (!titleData) {
          return NextResponse.json({ error: 'Title not found on TMDB' }, { status: 404 });
        }
        break;

      case 'Simkl':
        // SIMKL doesn't have a direct details endpoint, so we'll use search
        return NextResponse.json({ error: 'Direct SIMKL details not supported' }, { status: 400 });

      default:
        return NextResponse.json({ error: 'Unsupported source' }, { status: 400 });
    }

    if (!titleData) {
      return NextResponse.json({ error: 'Title not found' }, { status: 404 });
    }

    // Enhance with SIMKL data if IMDb ID is available
    let ratings = null;
    let simklDetails = null;
    let simklEpisodes = null;
    const imdbId = titleData.content?.externalIds?.imdbId || titleData.imdb_id;

    if (imdbId) {
      try {
        // Check enhanced cache first for ratings
        const { getCachedRatings } = await import('@/lib/database');
        const cachedRatings = await getCachedRatings(imdbId);

        if (cachedRatings && cachedRatings.length > 0) {
          const simklRating = cachedRatings.find(r => r.source === 'simkl');
          if (simklRating && simklRating.data) {
            // Use cached SIMKL data
            simklDetails = (simklRating.data as any).simklDetails || null;
            ratings = simklRating.data;

            if (process.env.NODE_ENV === 'development') {
              console.log(`[DEBUG] Using cached SIMKL data for ${imdbId}`);
            }
          }
        }

        // If not cached and SIMKL is configured, fetch from API
        if (!simklDetails && simklService.isConfigured()) {
          // Try to get detailed SIMKL data first
          const mediaType =
            titleData.objectType?.toLowerCase() === 'show' || titleData.name ? 'tv' : 'movie';

          if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] Processing title: ${titleData.content?.title || titleData.title}`);
            console.log(`[DEBUG] IMDb ID: ${imdbId}, Media Type: ${mediaType}`);
          }

          simklDetails = await simklService.getDetailsByImdbId(imdbId, mediaType);

          if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] SIMKL Details fetched:`, {
              hasData: !!simklDetails,
              simklId: (simklDetails as any)?.ids?.simkl,
              title: (simklDetails as any)?.title,
              type: (simklDetails as any)?.type,
              hasRatings: !!(simklDetails as any)?.ratings,
            });
          }

          // If we got detailed data, use its ratings
          if (simklDetails && (simklDetails as any)?.ratings) {
            ratings = {
              simkl: (simklDetails as any).ratings.simkl,
              external: {
                imdb: (simklDetails as any).ratings.imdb,
              },
            };
          }

          // For TV shows, also fetch episodes
          if (mediaType === 'tv' && simklDetails && (simklDetails as any)?.ids?.simkl) {
            try {
              simklEpisodes = await simklService.getEpisodes((simklDetails as any).ids.simkl);

              if (process.env.NODE_ENV === 'development') {
                console.log(`[DEBUG] Episodes fetched:`, {
                  episodeCount: simklEpisodes?.length || 0,
                  seasons: simklEpisodes
                    ? [...new Set(simklEpisodes.map(ep => (ep as any).season).filter(s => s))]
                        .length
                    : 0,
                });
              }
            } catch (episodeError) {
              console.warn('Failed to fetch episodes:', episodeError);
            }
          }

          // If we didn't get detailed data but SIMKL is configured, try just ratings
          if (!simklDetails || !ratings) {
            ratings = await simklService.getRatingsByImdbId(imdbId);
          }
        } else if (!simklService.isConfigured()) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] SIMKL API key not configured, skipping SIMKL data fetch`);
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to fetch SIMKL data:', error);
        }
      }
    }

    const response = {
      title: titleData,
      offers: offers || {},
      ratings,
      simklDetails,
      simklEpisodes,
      source,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Title details API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle POST for batch title lookups
export async function POST(request: NextRequest, {}: RouteParams) {
  try {
    const body = await request.json();
    const { ids, source = 'JustWatch', country = 'US' } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Array of IDs is required' }, { status: 400 });
    }

    console.log(`Batch fetching ${ids.length} titles from ${source}`);

    const results = await Promise.allSettled(
      ids.map(async (id: string) => {
        switch (source) {
          case 'JustWatch':
            const titleResponse = await justWatchService.getTitleNode(id, country);
            return { id, data: titleResponse.data?.node };

          case 'Tmdb':
            const tmdbId = parseInt(id);
            if (isNaN(tmdbId)) throw new Error('Invalid TMDB ID');

            const movieData = await tmdbService.getMovieDetails(tmdbId);
            if (movieData) {
              return { id, data: movieData };
            } else {
              const tvData = await tmdbService.getTvDetails(tmdbId);
              if (tvData) {
                return { id, data: tvData };
              } else {
                throw new Error('Title not found on TMDB');
              }
            }

          default:
            throw new Error('Unsupported source');
        }
      })
    );

    const successful = results
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<unknown>).value);

    const failed = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason.message);

    return NextResponse.json({
      results: successful,
      errors: failed,
      total: ids.length,
      successful: successful.length,
      failed: failed.length,
    });
  } catch (error) {
    console.error('Batch title details API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
