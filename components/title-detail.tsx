'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Star,
  Calendar,
  Clock,
  Globe,
  ExternalLink,
  Play,
  Users,
  ArrowLeft,
  Filter,
  ChevronDown,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { UnifiedSearchResult } from '@/lib/types';
import { StreamingTableSkeleton } from '@/components/skeletons/streaming-table-skeleton';
import { DownloadButton } from '@/components/download-button';
import { DownloadModal } from '@/components/download-modal';

interface TitleDetailProps {
  result: UnifiedSearchResult;
  onBack?: () => void;
  className?: string;
}

interface TitleDetailData {
  title: Record<string, unknown>;
  offers: Record<string, unknown[]>;
  ratings: Record<string, unknown>;
  simklDetails: Record<string, unknown>;
  simklEpisodes: unknown[];
  source: string;
}

export function TitleDetail({ result, onBack, className = '' }: TitleDetailProps) {
  const [detailData, setDetailData] = useState<TitleDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedAudioLanguages, setSelectedAudioLanguages] = useState<string[]>([]);
  const [selectedSubtitleLanguages, setSelectedSubtitleLanguages] = useState<string[]>([]);
  const [selectedAudioTech, setSelectedAudioTech] = useState<string[]>([]);
  const [selectedResolutions, setSelectedResolutions] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Download modal state
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [selectedDownloadOffer, setSelectedDownloadOffer] = useState<any>(null);
  const [selectedServiceMatch, setSelectedServiceMatch] = useState<any>(null);

  // Handle download button click
  const handleDownloadClick = (offer: any, serviceMatch: any) => {
    setSelectedDownloadOffer(offer);
    setSelectedServiceMatch(serviceMatch);
    setIsDownloadModalOpen(true);
  };

  useEffect(() => {
    const fetchDetails = async () => {
      if (result.source !== 'JustWatch') {
        // For non-JustWatch results, we don't have detailed offer data
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Check if this result has duplicate IDs from merging
        const duplicateIds = (result as UnifiedSearchResult & { _duplicateIds?: string[] })
          ._duplicateIds || [result.id];
        const duplicateParam =
          duplicateIds.length > 1 ? `&duplicateIds=${duplicateIds.join(',')}` : '';

        if (process.env.NODE_ENV === 'development') {
          console.log(`[DEBUG] Result object:`, {
            id: result.id,
            title: result.title,
            hasDuplicateIds: !!(result as UnifiedSearchResult & { _duplicateIds?: string[] })
              ._duplicateIds,
            duplicateIds: duplicateIds,
            duplicateParam: duplicateParam,
          });
        }

        const apiUrl = `/api/title/${result.id}?source=${result.source}&country=US${duplicateParam}`;

        if (process.env.NODE_ENV === 'development') {
          console.log(`[DEBUG] Making API call to: ${apiUrl}`);
        }

        const response = await fetch(apiUrl);

        if (!response.ok) {
          throw new Error('Failed to fetch title details');
        }

        const data = await response.json();
        setDetailData(data);
      } catch (err) {
        console.error('Error fetching title details:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [result.id, result.source, result]);

  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  // Format display values for better readability
  const formatDisplayValue = (
    value: string,
    type: 'resolution' | 'audioTech' | 'general' = 'general'
  ): string => {
    if (!value) return value;

    if (type === 'resolution') {
      const resolutionMap: Record<string, string> = {
        _4K: 'UHD',
        '4K': 'UHD',
        HD: 'HD',
        SD: 'SD',
        STANDARD: 'Standard',
      };
      return resolutionMap[value] || value;
    }

    if (type === 'audioTech') {
      const audioTechMap: Record<string, string> = {
        _5_POINT_1: '5.1',
        '5_POINT_1': '5.1',
        DOLBY_ATMOS: 'Atmos',
        DOLBY_DIGITAL: 'Dolby Digital',
        DTS: 'DTS',
        STEREO: 'Stereo',
        MONO: 'Mono',
      };
      return audioTechMap[value] || value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // General formatting - replace underscores and capitalize
    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const renderLanguages = (languages: string[] | string | undefined) => {
    if (!languages) return <span className="text-muted-foreground text-xs">N/A</span>;

    const langArray = Array.isArray(languages) ? languages : [languages];

    if (langArray.length === 0) return <span className="text-muted-foreground text-xs">N/A</span>;

    return (
      <div className="flex flex-wrap gap-1">
        {langArray.map((lang, index) => (
          <Badge key={index} variant="outline" className="text-xs">
            {lang.toUpperCase()}
          </Badge>
        ))}
      </div>
    );
  };

  const getMediaTypeBadge = (mediaType: string) => {
    const type = mediaType.toLowerCase();
    if (type === 'movie') return { label: 'Movie', variant: 'default' as const };
    if (type === 'tv' || type === 'show')
      return { label: 'TV Show', variant: 'secondary' as const };
    return { label: mediaType, variant: 'outline' as const };
  };

  // Get unique filter values from the offers data
  const getFilterOptions = () => {
    if (!detailData?.offers) return {};

    const allOffers = Object.entries(detailData.offers).flatMap(([country, offers]) =>
      Array.isArray(offers) ? offers.map((offer: any) => ({ ...offer, country })) : []
    );

    const countries = [...new Set(allOffers.map(offer => offer.country))].sort();
    const services = [
      ...new Set(allOffers.map(offer => offer.package?.clearName).filter(Boolean)),
    ].sort();
    const resolutions = [
      ...new Set(allOffers.map(offer => offer.presentationType).filter(Boolean)),
    ].sort();

    const audioLanguages = [
      ...new Set(
        allOffers.flatMap(offer => {
          const langs = offer.audioLanguages;
          return Array.isArray(langs) ? langs : langs ? [langs] : [];
        })
      ),
    ].sort();

    const subtitleLanguages = [
      ...new Set(
        allOffers.flatMap(offer => {
          const langs = offer.subtitleLanguages;
          return Array.isArray(langs) ? langs : langs ? [langs] : [];
        })
      ),
    ].sort();

    const audioTech = [
      ...new Set(
        allOffers.flatMap(offer => {
          const tech = offer.audioTechnology;
          return Array.isArray(tech) ? tech : tech ? [tech] : [];
        })
      ),
    ].sort();

    return { countries, services, resolutions, audioLanguages, subtitleLanguages, audioTech };
  };

  // Filter the offers based on selected filters
  const getFilteredOffers = () => {
    if (!detailData?.offers) return {};

    const filtered: Record<string, any[]> = {};

    Object.entries(detailData.offers).forEach(([country, offers]) => {
      if (!Array.isArray(offers)) return;

      const filteredOffers = offers.filter((offer: any) => {
        // Country filter
        if (selectedCountries.length > 0 && !selectedCountries.includes(country)) {
          return false;
        }

        // Service filter
        if (selectedServices.length > 0 && !selectedServices.includes(offer.package?.clearName)) {
          return false;
        }

        // Resolution filter
        if (
          selectedResolutions.length > 0 &&
          !selectedResolutions.includes(offer.presentationType)
        ) {
          return false;
        }

        // Audio language filter
        if (selectedAudioLanguages.length > 0) {
          const audioLangs = Array.isArray(offer.audioLanguages)
            ? offer.audioLanguages
            : offer.audioLanguages
              ? [offer.audioLanguages]
              : [];
          if (!audioLangs.some((lang: string) => selectedAudioLanguages.includes(lang))) {
            return false;
          }
        }

        // Subtitle language filter
        if (selectedSubtitleLanguages.length > 0) {
          const subLangs = Array.isArray(offer.subtitleLanguages)
            ? offer.subtitleLanguages
            : offer.subtitleLanguages
              ? [offer.subtitleLanguages]
              : [];
          if (!subLangs.some((lang: string) => selectedSubtitleLanguages.includes(lang))) {
            return false;
          }
        }

        // Audio technology filter
        if (selectedAudioTech.length > 0) {
          const audioTech = Array.isArray(offer.audioTechnology)
            ? offer.audioTechnology
            : offer.audioTechnology
              ? [offer.audioTechnology]
              : [];
          if (!audioTech.some((tech: string) => selectedAudioTech.includes(tech))) {
            return false;
          }
        }

        return true;
      });

      if (filteredOffers.length > 0) {
        filtered[country] = filteredOffers;
      }
    });

    return filtered;
  };

  // Helper functions for filter management
  const toggleFilter = (
    value: string,
    selectedValues: string[],
    setSelectedValues: (values: string[]) => void
  ) => {
    if (selectedValues.includes(value)) {
      setSelectedValues(selectedValues.filter(v => v !== value));
    } else {
      setSelectedValues([...selectedValues, value]);
    }
  };

  const clearAllFilters = () => {
    setSelectedCountries([]);
    setSelectedServices([]);
    setSelectedAudioLanguages([]);
    setSelectedSubtitleLanguages([]);
    setSelectedAudioTech([]);
    setSelectedResolutions([]);
  };

  const hasActiveFilters =
    selectedCountries.length > 0 ||
    selectedServices.length > 0 ||
    selectedAudioLanguages.length > 0 ||
    selectedSubtitleLanguages.length > 0 ||
    selectedAudioTech.length > 0 ||
    selectedResolutions.length > 0;

  const filterOptions = getFilterOptions();
  const filteredOffers = getFilteredOffers();

  const mediaTypeBadge = getMediaTypeBadge(result.mediaType);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with back button */}
      {onBack && (
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Results
        </Button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Title Information */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start space-x-4">
                {result.posterUrl && (
                  <Image
                    src={result.posterUrl}
                    alt={result.title}
                    width={120}
                    height={180}
                    className="rounded-lg object-cover flex-shrink-0"
                    unoptimized
                  />
                )}

                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl">{result.title}</CardTitle>
                      {result.originalTitle && result.originalTitle !== result.title && (
                        <p className="text-muted-foreground">{result.originalTitle}</p>
                      )}
                    </div>

                    <Badge variant={mediaTypeBadge.variant}>{mediaTypeBadge.label}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {result.releaseYear && (
                      <Badge variant="outline" className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{result.releaseYear}</span>
                      </Badge>
                    )}

                    {/* Use SIMKL runtime if available, fallback to result runtime */}
                    {((detailData?.simklDetails as any)?.runtime || result.runtime) && (
                      <Badge variant="outline" className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {(detailData?.simklDetails as any)?.runtime || result.runtime} min
                        </span>
                      </Badge>
                    )}

                    {/* Show certification from SIMKL if available */}
                    {(detailData?.simklDetails as any)?.certification && (
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        <span>{(detailData?.simklDetails as any).certification}</span>
                      </Badge>
                    )}

                    {/* Show network/studio from SIMKL if available */}
                    {(detailData?.simklDetails as any)?.network && (
                      <Badge variant="outline" className="flex items-center space-x-1">
                        <span>{(detailData?.simklDetails as any).network}</span>
                      </Badge>
                    )}

                    <Badge variant="outline" className="flex items-center space-x-1">
                      <Globe className="h-3 w-3" />
                      <span>Source: {result.source}</span>
                    </Badge>
                  </div>

                  {/* Use SIMKL overview if available and longer, otherwise use result overview */}
                  {((detailData?.simklDetails as any)?.overview || result.overview) && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {(detailData?.simklDetails as any)?.overview &&
                      (detailData?.simklDetails as any).overview.length >
                        (result.overview?.length || 0)
                        ? (detailData?.simklDetails as any).overview
                        : result.overview || (detailData?.simklDetails as any)?.overview}
                    </p>
                  )}

                  {/* Episode Information for TV Shows */}
                  {detailData?.simklEpisodes &&
                    detailData.simklEpisodes.length > 0 &&
                    result.mediaType === 'tv' && (
                      <div className="mt-4 pt-4 border-t border-border">
                        {(() => {
                          // Process episodes to get stats
                          const episodes = detailData.simklEpisodes || [];
                          const regularEpisodes = episodes.filter(
                            ep => (ep as any).type === 'episode'
                          );
                          const specials = episodes.filter(ep => (ep as any).type === 'special');
                          const airedEpisodes = regularEpisodes.filter(
                            ep => (ep as any).aired
                          ).length;

                          // Group episodes by season
                          const episodesBySeasonMap = regularEpisodes.reduce(
                            (acc: Record<number, any[]>, ep) => {
                              const season = (ep as any).season || 0;
                              if (!acc[season]) acc[season] = [];
                              acc[season].push(ep);
                              return acc;
                            },
                            {}
                          );

                          const episodesBySeason = Object.entries(episodesBySeasonMap)
                            .map(([season, eps]) => ({ season: parseInt(season), episodes: eps }))
                            .sort((a, b) => a.season - b.season);

                          const totalSeasons = episodesBySeason.length;
                          const totalEpisodes = regularEpisodes.length;

                          return (
                            <div className="space-y-2">
                              {/* Summary Stats */}
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <Play className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-medium text-primary">{totalSeasons}</span>
                                  <span className="text-muted-foreground">
                                    season{totalSeasons !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-medium text-primary">{totalEpisodes}</span>
                                  <span className="text-muted-foreground">
                                    episode{totalEpisodes !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                {airedEpisodes < totalEpisodes && (
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium text-green-600">
                                      {airedEpisodes}
                                    </span>
                                    <span className="text-muted-foreground">aired</span>
                                  </div>
                                )}
                                {specials.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium text-purple-600">
                                      {specials.length}
                                    </span>
                                    <span className="text-muted-foreground">
                                      special{specials.length !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Season Breakdown */}
                              {episodesBySeason.length > 1 && (
                                <div className="flex flex-wrap gap-1">
                                  {episodesBySeason.map(({ season, episodes }) => {
                                    const airedInSeason = episodes.filter(ep => ep.aired).length;
                                    return (
                                      <div
                                        key={season}
                                        className="bg-muted/50 rounded px-2 py-0.5 text-xs"
                                      >
                                        <span className="font-medium">S{season}:</span>{' '}
                                        <span>{episodes.length}</span>
                                        {airedInSeason < episodes.length && (
                                          <span className="text-green-600 ml-1">
                                            ({airedInSeason})
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                  {/* External Links */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex flex-wrap gap-2">
                      {result.imdbId && (
                        <a
                          href={`https://www.imdb.com/title/${result.imdbId}`}
                          rel="noopener noreferrer"
                        >
                          <Badge
                            variant="outline"
                            className="flex items-center space-x-1 hover:bg-muted"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>IMDb</span>
                          </Badge>
                        </a>
                      )}

                      {result.tmdbId && (
                        <a
                          href={`https://www.themoviedb.org/${result.mediaType === 'tv' ? 'tv' : 'movie'}/${result.tmdbId}`}
                          rel="noopener noreferrer"
                        >
                          <Badge
                            variant="outline"
                            className="flex items-center space-x-1 hover:bg-muted"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>TMDB</span>
                          </Badge>
                        </a>
                      )}

                      {result.justWatchUrl && (
                        <a href={result.justWatchUrl} rel="noopener noreferrer">
                          <Badge
                            variant="outline"
                            className="flex items-center space-x-1 hover:bg-muted"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>JustWatch</span>
                          </Badge>
                        </a>
                      )}

                      {(result.simklId || (detailData?.simklDetails as any)?.ids?.simkl) && (
                        <a
                          href={`https://simkl.com/${result.mediaType === 'tv' ? 'tv' : 'movies'}/${result.simklId || (detailData?.simklDetails as any)?.ids?.simkl}`}
                          rel="noopener noreferrer"
                        >
                          <Badge
                            variant="outline"
                            className="flex items-center space-x-1 hover:bg-muted"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>SIMKL</span>
                          </Badge>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            {/* Show genres - prefer SIMKL genres if available and more complete */}
            {(((detailData?.simklDetails as any)?.genres &&
              (detailData?.simklDetails as any)?.genres.length > 0) ||
              (result.genres && result.genres.length > 0)) && (
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1">
                  {((detailData?.simklDetails as any)?.genres?.length > (result.genres?.length || 0)
                    ? (detailData?.simklDetails as any)?.genres
                    : result.genres || (detailData?.simklDetails as any)?.genres || []
                  ).map((genre: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {genre}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Sidebar with ratings and external links */}
        <div className="space-y-4">
          {/* Ratings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="h-5 w-5" />
                <span>Ratings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.rating && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{result.source} Rating</span>
                  <div className="flex items-center space-x-1">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="font-semibold">{result.rating.toFixed(1)}</span>
                  </div>
                </div>
              )}

              {result.voteCount && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Vote Count</span>
                  <div className="flex items-center space-x-1">
                    <Users className="h-4 w-4" />
                    <span>{result.voteCount.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {(detailData?.ratings || (detailData?.simklDetails as any)?.ratings) && (
                <>
                  <Separator />
                  {/* SIMKL Rating */}
                  {((detailData?.simklDetails as any)?.ratings?.simkl?.rating ||
                    (detailData?.ratings as any)?.simkl?.rating) && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">SIMKL</span>
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span>
                          {(
                            (detailData?.simklDetails as any)?.ratings?.simkl?.rating ||
                            (detailData?.ratings as any)?.simkl?.rating
                          ).toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          (
                          {(
                            (detailData?.simklDetails as any)?.ratings?.simkl?.votes ||
                            (detailData?.ratings as any)?.simkl?.votes ||
                            0
                          ).toLocaleString()}
                          )
                        </span>
                      </div>
                    </div>
                  )}

                  {/* IMDb Rating */}
                  {((detailData?.simklDetails as any)?.ratings?.imdb?.rating ||
                    (detailData?.ratings as any)?.external?.imdb?.rating) && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">IMDb</span>
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span>
                          {(
                            (detailData?.simklDetails as any)?.ratings?.imdb?.rating ||
                            (detailData?.ratings as any)?.external?.imdb?.rating
                          ).toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          (
                          {(
                            (detailData?.simklDetails as any)?.ratings?.imdb?.votes ||
                            (detailData?.ratings as any)?.external?.imdb?.votes ||
                            0
                          ).toLocaleString()}
                          )
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {error && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-sm text-muted-foreground">
                  <p>Unable to load additional details</p>
                  <p className="text-xs mt-1">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Streaming Availability Section - Only show for JustWatch sources */}
      {result.source === 'JustWatch' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Play className="h-5 w-5" />
                <span>Streaming Availability</span>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2">
                    {Object.keys(filteredOffers).reduce(
                      (acc, country) => acc + filteredOffers[country].length,
                      0
                    )}{' '}
                    filtered
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center space-x-2">
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear Filters
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="h-4 w-4 mr-1" />
                  Filters
                  <ChevronDown
                    className={`h-4 w-4 ml-1 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                  />
                </Button>
              </div>
            </div>

            {/* Filter Panel */}
            <Collapsible open={showFilters} onOpenChange={setShowFilters}>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Countries Filter */}
                  {filterOptions.countries && filterOptions.countries.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Countries</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {filterOptions.countries.map(country => (
                          <div key={country} className="flex items-center space-x-2">
                            <Checkbox
                              id={`country-${country}`}
                              checked={selectedCountries.includes(country)}
                              onCheckedChange={() =>
                                toggleFilter(country, selectedCountries, setSelectedCountries)
                              }
                            />
                            <label
                              htmlFor={`country-${country}`}
                              className="text-sm cursor-pointer"
                            >
                              {country.toUpperCase()}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Services Filter */}
                  {filterOptions.services && filterOptions.services.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Services</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {filterOptions.services.map(service => (
                          <div key={service} className="flex items-center space-x-2">
                            <Checkbox
                              id={`service-${service}`}
                              checked={selectedServices.includes(service)}
                              onCheckedChange={() =>
                                toggleFilter(service, selectedServices, setSelectedServices)
                              }
                            />
                            <label
                              htmlFor={`service-${service}`}
                              className="text-sm cursor-pointer"
                            >
                              {service}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resolution Filter */}
                  {filterOptions.resolutions && filterOptions.resolutions.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Resolution</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {filterOptions.resolutions.map(resolution => (
                          <div key={resolution} className="flex items-center space-x-2">
                            <Checkbox
                              id={`resolution-${resolution}`}
                              checked={selectedResolutions.includes(resolution)}
                              onCheckedChange={() =>
                                toggleFilter(
                                  resolution,
                                  selectedResolutions,
                                  setSelectedResolutions
                                )
                              }
                            />
                            <label
                              htmlFor={`resolution-${resolution}`}
                              className="text-sm cursor-pointer"
                            >
                              {formatDisplayValue(resolution, 'resolution')}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Audio Languages Filter */}
                  {filterOptions.audioLanguages && filterOptions.audioLanguages.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Audio Languages</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {filterOptions.audioLanguages.map(lang => (
                          <div key={lang} className="flex items-center space-x-2">
                            <Checkbox
                              id={`audio-${lang}`}
                              checked={selectedAudioLanguages.includes(lang)}
                              onCheckedChange={() =>
                                toggleFilter(
                                  lang,
                                  selectedAudioLanguages,
                                  setSelectedAudioLanguages
                                )
                              }
                            />
                            <label htmlFor={`audio-${lang}`} className="text-sm cursor-pointer">
                              {lang.toUpperCase()}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subtitle Languages Filter */}
                  {filterOptions.subtitleLanguages &&
                    filterOptions.subtitleLanguages.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Subtitle Languages</h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {filterOptions.subtitleLanguages.map(lang => (
                            <div key={lang} className="flex items-center space-x-2">
                              <Checkbox
                                id={`subtitle-${lang}`}
                                checked={selectedSubtitleLanguages.includes(lang)}
                                onCheckedChange={() =>
                                  toggleFilter(
                                    lang,
                                    selectedSubtitleLanguages,
                                    setSelectedSubtitleLanguages
                                  )
                                }
                              />
                              <label
                                htmlFor={`subtitle-${lang}`}
                                className="text-sm cursor-pointer"
                              >
                                {lang.toUpperCase()}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Audio Technology Filter */}
                  {filterOptions.audioTech && filterOptions.audioTech.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Audio Technology</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {filterOptions.audioTech.map(tech => (
                          <div key={tech} className="flex items-center space-x-2">
                            <Checkbox
                              id={`audio-tech-${tech}`}
                              checked={selectedAudioTech.includes(tech)}
                              onCheckedChange={() =>
                                toggleFilter(tech, selectedAudioTech, setSelectedAudioTech)
                              }
                            />
                            <label
                              htmlFor={`audio-tech-${tech}`}
                              className="text-sm cursor-pointer"
                            >
                              {formatDisplayValue(tech, 'audioTech')}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardHeader>

          <CardContent>
            {/* Show skeleton while loading */}
            {isLoading ? (
              <StreamingTableSkeleton />
            ) : /* Show streaming table if data is available and has offers */
            detailData?.offers && Object.keys(detailData.offers).length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Monetization</TableHead>
                      <TableHead>Resolution</TableHead>
                      <TableHead>Audio Technology</TableHead>
                      <TableHead>Subtitle Languages</TableHead>
                      <TableHead>Audio Languages</TableHead>
                      <TableHead>Download</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(filteredOffers).flatMap(([country, offers]) => {
                      if (!Array.isArray(offers) || offers.length === 0) return [];

                      return offers.map((offer: any, index: number) => {
                        // Ensure the country code is properly attached to the offer
                        const offerWithCountry = {
                          ...offer,
                          country: country.toLowerCase(), // Normalize to lowercase 2-letter country code
                        };

                        return (
                          <TableRow key={`${country}-${index}`}>
                            <TableCell>
                              {offer.standardWebURL ? (
                                <a
                                  href={offer.standardWebURL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-1 text-primary hover:underline"
                                >
                                  <span>{offer.package?.clearName || 'Unknown'}</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span>{offer.package?.clearName || 'Unknown'}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{country.toUpperCase()}</Badge>
                            </TableCell>
                            <TableCell>
                              {offer.retailPriceValue ? (
                                <span className="font-medium">
                                  {formatCurrency(offer.retailPriceValue, offer.currency)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Free</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  offer.monetizationType === 'FREE' ? 'secondary' : 'default'
                                }
                              >
                                {offer.monetizationType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {formatDisplayValue(
                                  offer.presentationType || 'Standard',
                                  'resolution'
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">
                                {Array.isArray(offer.audioTechnology)
                                  ? offer.audioTechnology
                                      .map((tech: any) => formatDisplayValue(tech, 'audioTech'))
                                      .join(', ')
                                  : formatDisplayValue(offer.audioTechnology || 'N/A', 'audioTech')}
                              </span>
                            </TableCell>
                            <TableCell>{renderLanguages(offer.subtitleLanguages)}</TableCell>
                            <TableCell>{renderLanguages(offer.audioLanguages)}</TableCell>
                            <TableCell>
                              <DownloadButton
                                offer={offerWithCountry}
                                onDownloadClick={handleDownloadClick}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* Only show 'no data' message if loading is complete and there's no data */
              !isLoading &&
              detailData && (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <div>
                    <p className="text-lg font-medium mb-2">No Streaming Offers Available</p>
                    <p className="text-sm">
                      This title is currently not available on major streaming platforms in the
                      regions we monitor.
                    </p>
                  </div>
                </div>
              )
            )}

            {hasActiveFilters &&
              Object.keys(filteredOffers).length === 0 &&
              detailData?.offers &&
              Object.keys(detailData.offers).length > 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No streaming offers match the selected filters.</p>
                  <Button variant="outline" onClick={clearAllFilters} className="mt-2">
                    Clear all filters
                  </Button>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Download Modal */}
      {selectedDownloadOffer && selectedServiceMatch && (
        <DownloadModal
          isOpen={isDownloadModalOpen}
          onClose={() => {
            setIsDownloadModalOpen(false);
            setSelectedDownloadOffer(null);
            setSelectedServiceMatch(null);
          }}
          serviceMatch={selectedServiceMatch}
          streamingOffer={selectedDownloadOffer}
          titleInfo={{
            title: result.title,
            mediaType: result.mediaType === 'tv' ? 'tv' : 'movie',
            tmdbId: result.tmdbId,
            imdbId: result.imdbId,
          }}
          simklEpisodes={detailData?.simklEpisodes}
        />
      )}
    </div>
  );
}
