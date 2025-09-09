import { JustWatchSearchResponse, JustWatchTitle, ApiError } from '@/lib/types';
import { getCachedData, setCachedData } from '@/lib/database';
import { cacheManager, StreamingOffer } from '@/lib/cache-manager';

const JUSTWATCH_GRAPHQL_URL = 'https://apis.justwatch.com/graphql';

interface GraphQLRequest {
  operationName: string;
  query: string;
  variables: Record<string, unknown>;
}

export class JustWatchService {
  private async executeGraphQLQuery<T>(request: GraphQLRequest): Promise<T> {
    const cacheKey = `justwatch:${request.operationName}:${JSON.stringify(request.variables)}`;
    const cachedResult = getCachedData<T>(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    try {
      const response = await fetch(JUSTWATCH_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new ApiError(
          `JustWatch API error: ${response.statusText}`,
          'JustWatch',
          response.status
        );
      }

      const data = await response.json();

      if (data.errors) {
        throw new ApiError(`GraphQL error: ${data.errors[0]?.message}`, 'JustWatch');
      }

      // Cache asynchronously - don't block the response
      const cacheTTL = parseInt(process.env.CACHE_TTL_SEARCH || '3600');
      setImmediate(() => {
        try {
          setCachedData(cacheKey, data, cacheTTL);
        } catch (error) {
          console.error('Background caching error:', error);
        }
      });

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Failed to execute JustWatch query: ${error}`, 'JustWatch');
    }
  }

  async searchTitles(query: string, country: string = 'US'): Promise<JustWatchSearchResponse> {
    const graphqlRequest: GraphQLRequest = {
      operationName: 'GetSearchTitles',
      query: this.getSearchTitlesQuery(),
      variables: {
        searchTitlesFilter: {
          searchQuery: query,
          includeTitlesWithoutUrl: true,
        },
        country,
        language: 'en',
        first: parseInt(process.env.MAX_RESULTS_PER_SOURCE || '20'),
        formatPoster: 'JPG',
        formatOfferIcon: 'PNG',
        profile: 'S718',
        backdropProfile: 'S1920',
        filter: {},
      },
    };

    return this.executeGraphQLQuery<JustWatchSearchResponse>(graphqlRequest);
  }

  async getPopularTitles(
    country: string = 'US',
    limit: number = 50
  ): Promise<JustWatchSearchResponse> {
    const cacheKey = `justwatch:popular:${country}:${limit}`;
    const cachedResult = getCachedData<JustWatchSearchResponse>(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const graphqlRequest: GraphQLRequest = {
      operationName: 'GetPopularTitles',
      query: this.getPopularTitlesQuery(),
      variables: {
        searchTitlesFilter: {
          searchQuery: '',
          includeTitlesWithoutUrl: true,
        },
        country,
        language: 'en',
        first: limit,
        formatPoster: 'JPG',
        formatOfferIcon: 'PNG',
        profile: 'S718',
        backdropProfile: 'S1920',
        filter: {},
      },
    };

    const result = await this.executeGraphQLQuery<JustWatchSearchResponse>(graphqlRequest);

    // Cache for 6 hours since popular content doesn't change frequently
    const cacheTTL = 21600; // 6 hours
    setCachedData(cacheKey, result, cacheTTL);

    return result;
  }

  async getTitleNode(
    nodeId: string,
    country: string = 'US'
  ): Promise<{ data: { node: JustWatchTitle } }> {
    const graphqlRequest: GraphQLRequest = {
      operationName: 'GetTitleNode',
      query: this.getTitleNodeQuery(),
      variables: {
        nodeId,
        country,
        language: 'en',
        formatPoster: 'JPG',
        formatOfferIcon: 'PNG',
        profile: 'S718',
        backdropProfile: 'S1920',
      },
    };

    return this.executeGraphQLQuery(graphqlRequest);
  }

  async getTitleOffers(
    nodeId: string,
    countries: string[]
  ): Promise<{
    data: {
      node: Record<string, unknown[]>;
    };
  }> {
    // Try to get cached offers first
    const cachedOffersMap = new Map<string, unknown[]>();
    const countriesToFetch: string[] = [];

    for (const country of countries) {
      const cachedOffers = await cacheManager.getStreamingOffers(nodeId, country);
      if (cachedOffers) {
        // Transform back to API format
        const offersByCountry = cachedOffers.map(offer => offer.data);
        cachedOffersMap.set(country.toLowerCase(), offersByCountry);
      } else {
        countriesToFetch.push(country);
      }
    }

    // If all countries are cached, return cached data
    if (countriesToFetch.length === 0) {
      const result: { data: { node: Record<string, unknown[]> } } = {
        data: { node: {} },
      };
      cachedOffersMap.forEach((offers, country) => {
        result.data.node[country] = offers;
      });
      return result;
    }

    // Fetch uncached countries
    const graphqlRequest: GraphQLRequest = {
      operationName: 'GetTitleOffers',
      query: this.getTitleOffersQuery(countriesToFetch),
      variables: {
        nodeId,
        language: 'en',
        platform: 'WEB',
      },
    };

    const result: { data: { node: Record<string, unknown[]> } } =
      await this.executeGraphQLQuery(graphqlRequest);

    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] Offers API response for ${nodeId}:`, {
        hasData: !!result?.data,
        hasNode: !!result?.data?.node,
        countries: countriesToFetch,
        nodeKeys: result?.data?.node ? Object.keys(result.data.node) : [],
      });
    }

    // Cache the fresh offers asynchronously (don't wait for it)
    if (result?.data?.node) {
      // Fire and forget - cache in background
      setImmediate(async () => {
        try {
          const offersToCache: StreamingOffer[] = [];

          for (const country of countriesToFetch) {
            const countryOffers = result.data.node[country.toLowerCase()];
            if (countryOffers && Array.isArray(countryOffers)) {
              if (process.env.NODE_ENV === 'development') {
                console.log(`[DEBUG] Found ${countryOffers.length} offers for ${country}`);
              }
              countryOffers.forEach(offer => {
                offersToCache.push(
                  cacheManager.transformOfferForCache(offer as any, nodeId, country)
                );
              });
            }
          }

          if (offersToCache.length > 0) {
            await cacheManager.setStreamingOffers(offersToCache);
            if (process.env.NODE_ENV === 'development') {
              console.log(
                `[DEBUG] Cached ${offersToCache.length} offers for ${nodeId} in background`
              );
            }
          } else if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] No offers to cache for ${nodeId}`);
          }
        } catch (error) {
          console.error('Background caching error:', error);
        }
      });
    }

    // Merge cached and fresh data
    if (cachedOffersMap.size > 0 && result?.data?.node) {
      cachedOffersMap.forEach((offers, country) => {
        if (!result.data.node[country]) {
          result.data.node[country] = offers;
        }
      });
    }

    // Also cache the complete result for fast retrieval
    const cacheTTL = parseInt(process.env.CACHE_TTL_OFFERS || '21600');
    const cacheKey = `justwatch:offers:${nodeId}:${countries.join(',')}`;
    setCachedData(cacheKey, result, cacheTTL);

    return result;
  }

  private getSearchTitlesQuery(): string {
    return `
      query GetSearchTitles(
        $searchTitlesFilter: TitleFilter!,
        $country: Country!,
        $language: Language!,
        $first: Int!,
        $formatPoster: ImageFormat,
        $profile: PosterProfile,
        $backdropProfile: BackdropProfile,
      ) {
        popularTitles(
          country: $country
          filter: $searchTitlesFilter
          first: $first
          sortBy: POPULAR
          sortRandomSeed: 0
        ) {
          edges {
            ...SearchTitleGraphql
            __typename
          }
          __typename
        }
      }

      fragment SearchTitleGraphql on PopularTitlesEdge {
        node {
          id
          objectId
          objectType
          content(country: $country, language: $language) {
            title
            fullPath
            originalReleaseYear
            originalReleaseDate
            productionCountries
            runtime
            shortDescription
            genres {
              shortName
              __typename
            }
            externalIds {
              imdbId
              tmdbId
              __typename
            }
            posterUrl(profile: $profile, format: $formatPoster)
            backdrops(profile: $backdropProfile, format: $formatPoster) {
              backdropUrl
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
    `;
  }

  private getPopularTitlesQuery(): string {
    return `
      query GetPopularTitles(
        $searchTitlesFilter: TitleFilter!,
        $country: Country!,
        $language: Language!,
        $first: Int!,
        $formatPoster: ImageFormat,
        $profile: PosterProfile,
        $backdropProfile: BackdropProfile,
      ) {
        popularTitles(
          country: $country
          filter: $searchTitlesFilter
          first: $first
          sortBy: POPULAR
          sortRandomSeed: 0
        ) {
          edges {
            ...PopularTitleGraphql
            __typename
          }
          __typename
        }
      }

      fragment PopularTitleGraphql on PopularTitlesEdge {
        node {
          id
          objectId
          objectType
          content(country: $country, language: $language) {
            title
            fullPath
            originalReleaseYear
            originalReleaseDate
            productionCountries
            runtime
            shortDescription
            genres {
              shortName
              __typename
            }
            externalIds {
              imdbId
              tmdbId
              __typename
            }
            posterUrl(profile: $profile, format: $formatPoster)
            backdrops(profile: $backdropProfile, format: $formatPoster) {
              backdropUrl
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
    `;
  }

  private getTitleNodeQuery(): string {
    return `
      query GetTitleNode(
        $nodeId: ID!, 
        $language: Language!, 
        $country: Country!,
        $formatPoster: ImageFormat,
        $profile: PosterProfile,
        $backdropProfile: BackdropProfile
      ) {
        node(id: $nodeId) {
          ... on MovieOrShow {
            id
            objectId
            objectType
            content(country: $country, language: $language) {
              title
              fullPath
              originalReleaseYear
              originalReleaseDate
              productionCountries
              runtime
              shortDescription
              genres {
                shortName
                __typename
              }
              externalIds {
                imdbId
                tmdbId
                __typename
              }
              posterUrl(profile: $profile, format: $formatPoster)
              backdrops(profile: $backdropProfile, format: $formatPoster) {
                backdropUrl
                __typename
              }
              __typename
            }
            __typename
          }
        }
      }
    `;
  }

  private getTitleOffersQuery(countries: string[]): string {
    let query = `
      query GetTitleOffers($nodeId: ID!, $language: Language!, $platform: Platform! = WEB) {
        node(id: $nodeId) {
          ... on MovieOrShowOrSeasonOrEpisode {
    `;

    countries.forEach(country => {
      query += `
        ${country.toLowerCase()}: offers(country: ${country}, platform: $platform) {
          ...TitleOffer
          __typename
        }
      `;
    });

    query += `
          }
        }
      }

      fragment TitleOffer on Offer {
        id
        presentationType
        monetizationType
        retailPrice(language: $language)
        retailPriceValue
        currency
        lastChangeRetailPriceValue
        type
        package {
          id
          packageId
          clearName
          technicalName
          icon(profile: S100)
          __typename
        }
        standardWebURL
        elementCount
        availableTo
        deeplinkRoku: deeplinkURL(platform: ROKU_OS)
        subtitleLanguages
        videoTechnology
        audioTechnology
        audioLanguages
        __typename
      }
    `;

    return query;
  }
}

export const justWatchService = new JustWatchService();
