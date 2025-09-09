import { NextRequest, NextResponse } from 'next/server';
import { simklService } from '@/lib/services/simkl';

interface RouteParams {
  params: Promise<{
    imdbId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { imdbId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const sources = searchParams.get('sources') || 'simkl,ext,rank';

    if (!imdbId) {
      return NextResponse.json({ error: 'IMDb ID is required' }, { status: 400 });
    }

    // Validate IMDb ID format
    const imdbIdPattern = /^(tt)?\d+$/;
    if (!imdbIdPattern.test(imdbId)) {
      return NextResponse.json({ error: 'Invalid IMDb ID format' }, { status: 400 });
    }

    console.log(`Fetching ratings for IMDb ID: ${imdbId}`);

    const ratings = await simklService.getRatingsByImdbId(imdbId, sources);

    if (!ratings || !simklService.hasValidRatings(ratings)) {
      return NextResponse.json({ error: 'No ratings found for this title' }, { status: 404 });
    }

    const bestRating = simklService.getBestRating(ratings);

    const response = {
      imdbId,
      ratings,
      bestRating,
      sources: sources.split(','),
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Ratings API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle POST for batch ratings lookup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imdbIds, sources = 'simkl,ext,rank' } = body;

    if (!Array.isArray(imdbIds) || imdbIds.length === 0) {
      return NextResponse.json({ error: 'Array of IMDb IDs is required' }, { status: 400 });
    }

    if (imdbIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 IMDb IDs allowed per request' },
        { status: 400 }
      );
    }

    console.log(`Batch fetching ratings for ${imdbIds.length} titles`);

    const results = await Promise.allSettled(
      imdbIds.map(async (imdbId: string) => {
        const ratings = await simklService.getRatingsByImdbId(imdbId, sources);
        const bestRating = simklService.getBestRating(ratings);

        return {
          imdbId,
          ratings,
          bestRating,
          hasRatings: simklService.hasValidRatings(ratings),
        };
      })
    );

    const successful = results
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<unknown>).value);

    const failed = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result, index) => ({
        imdbId: imdbIds[index],
        error: result.reason.message,
      }));

    return NextResponse.json({
      results: successful,
      errors: failed,
      total: imdbIds.length,
      successful: successful.length,
      failed: failed.length,
      sources: sources.split(','),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Batch ratings API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
