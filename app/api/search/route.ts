import { NextRequest, NextResponse } from 'next/server';
import { unifiedSearchService } from '@/lib/services/unified-search';
import { ApiSource } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }

    // Parse search configuration from query parameters
    const enabledSources = ['JustWatch'] as ApiSource[]; // Force JustWatch only
    const country = searchParams.get('country') || process.env.DEFAULT_COUNTRY || 'US';
    const maxResultsPerSource = parseInt(
      searchParams.get('maxResults') || process.env.MAX_RESULTS_PER_SOURCE || '20'
    );
    const deduplicateResults = searchParams.get('dedupe') !== 'false';
    const mediaTypeFilter = searchParams.get('type') || undefined;

    const searchConfig = {
      enabledSources,
      country,
      maxResultsPerSource,
      deduplicateResults,
      mediaTypeFilter,
    };

    console.log('Search request:', { query, ...searchConfig });

    const results = await unifiedSearchService.search(query, searchConfig);

    // No longer enhance with ratings during search - only in title details

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        results: [],
        totalResults: 0,
        resultsBySource: {},
        errors: {},
      },
      { status: 500 }
    );
  }
}

// Handle POST requests for more complex search configurations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, configuration } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Override configuration to only use JustWatch
    const searchConfig = {
      ...configuration,
      enabledSources: ['JustWatch'] as ApiSource[],
    };

    console.log('Advanced search request:', { query, configuration: searchConfig });

    const results = await unifiedSearchService.search(query, searchConfig);

    // No longer enhance with ratings during search - only in title details

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
