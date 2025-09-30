'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Download,
  Loader2,
  AlertCircle,
  Settings,
  Monitor,
  Volume2,
  Subtitles,
  List,
  X,
} from 'lucide-react';
import { useDownloadStarter, useTrackListing } from '@/lib/hooks/use-download';
import { DownloadRequest, TrackInfo, EpisodeInfo, AudioTrack } from '@/lib/services/unshackle-api';
import { CountryFlag } from '@/components/country-flag';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceMatch: any;
  streamingOffer: any;
  titleInfo: {
    title: string;
    mediaType: 'movie' | 'tv';
    tmdbId?: string;
    imdbId?: string;
  };
  simklEpisodes?: unknown[];
}

interface DownloadConfig {
  quality: string;
  range: string;
  v_lang: string;
  a_lang: string;
  s_lang: string;
  episodes: {
    mode: 'all' | 'season' | 'specific';
    season?: number;
    list?: number[];
  };
  proxy?: string;
  profile?: string;
}

const QUALITY_OPTIONS = [
  { value: '2160', label: '4K (2160p)', description: 'Ultra HD' },
  { value: '1440', label: '1440p', description: 'Quad HD' },
  { value: '1080', label: '1080p', description: 'Full HD' },
  { value: '720', label: '720p', description: 'HD' },
  { value: '480', label: '480p', description: 'SD' },
  { value: 'best', label: 'Best Available', description: 'Highest quality' },
];

const HDR_OPTIONS = [
  { value: 'SDR', label: 'SDR', description: 'Standard Dynamic Range' },
  { value: 'HDR10', label: 'HDR10', description: 'High Dynamic Range' },
  { value: 'DV', label: 'Dolby Vision', description: 'Advanced HDR' },
];

const AUDIO_LANGUAGE_OPTIONS = [
  { value: 'EN', label: 'English' },
  { value: 'original', label: 'Original Language' },
  { value: 'ALL', label: 'All Languages' },
];

const SUBTITLE_OPTIONS = [
  { value: 'ALL', label: 'All Subtitles' },
  { value: 'EN', label: 'English Only' },
  { value: 'none', label: 'No Subtitles' },
];

/**
 * Deduplicate audio tracks by keeping only the highest bitrate per unique combination
 * of codec, channels, language, atmos, and descriptive flags.
 */
const deduplicateAudioTracks = (tracks: AudioTrack[]): AudioTrack[] => {
  if (!tracks || tracks.length === 0) return [];

  // Group by unique characteristics
  const groups = new Map<string, AudioTrack>();

  for (const track of tracks) {
    // Create a key from the track's unique characteristics
    const key = JSON.stringify({
      codec: track.codec,
      channels: track.channels,
      language: track.language,
      atmos: track.atmos,
      descriptive: track.descriptive,
    });

    const existing = groups.get(key);
    if (!existing || (track.bitrate && existing.bitrate && track.bitrate > existing.bitrate)) {
      groups.set(key, track);
    }
  }

  // Return deduplicated tracks grouped by language, sorted by bitrate within each group
  return Array.from(groups.values()).sort((a, b) => {
    // First sort by language
    const langCompare = (a.language || '').localeCompare(b.language || '');
    if (langCompare !== 0) return langCompare;
    // Then by bitrate descending within same language
    return (b.bitrate || 0) - (a.bitrate || 0);
  });
};

/**
 * Deduplicate video tracks by keeping only one track per unique resolution+codec+fps+range combination.
 */
const deduplicateVideoTracks = (tracks: any[]): any[] => {
  if (!tracks || tracks.length === 0) return [];

  const groups = new Map<string, any>();

  for (const track of tracks) {
    const key = JSON.stringify({
      resolution: track.resolution,
      codec: track.codec,
      fps: track.fps,
      range: track.range,
    });

    const existing = groups.get(key);
    if (!existing || (track.bitrate && existing.bitrate && track.bitrate > existing.bitrate)) {
      groups.set(key, track);
    }
  }

  // Sort by resolution (height) descending, then by bitrate
  return Array.from(groups.values()).sort((a, b) => {
    const heightA = a.height || 0;
    const heightB = b.height || 0;
    if (heightA !== heightB) return heightB - heightA;
    return (b.bitrate || 0) - (a.bitrate || 0);
  });
};

/**
 * Deduplicate subtitle tracks by keeping only unique language+flags combinations.
 */
const deduplicateSubtitleTracks = (tracks: any[]): any[] => {
  if (!tracks || tracks.length === 0) return [];

  const groups = new Map<string, any>();

  for (const track of tracks) {
    const key = JSON.stringify({
      language: track.language,
      forced: track.forced,
      sdh: track.sdh,
      cc: track.cc,
    });

    if (!groups.has(key)) {
      groups.set(key, track);
    }
  }

  // Sort by language alphabetically
  return Array.from(groups.values()).sort((a, b) =>
    (a.language || '').localeCompare(b.language || '')
  );
};

// Helper function to normalize country codes to 2-letter format
const normalizeCountryCode = (country: string | undefined): string => {
  if (!country) {
    console.warn('[DownloadModal] No country code provided, defaulting to US');
    return 'us';
  }

  // Normalize to lowercase 2-letter code
  const normalized = country.toLowerCase().trim();

  // Validate it's a 2-letter code
  if (normalized.length === 2 && /^[a-z]{2}$/.test(normalized)) {
    return normalized;
  }

  console.warn('[DownloadModal] Invalid country code:', country, 'defaulting to US');
  return 'us';
};

export function DownloadModal({
  isOpen,
  onClose,
  serviceMatch,
  streamingOffer,
  titleInfo,
  simklEpisodes,
}: DownloadModalProps) {
  // Debug logging
  console.log('[DownloadModal] Received serviceMatch:', serviceMatch);
  console.log('[DownloadModal] serviceMatch.service:', serviceMatch?.service);
  console.log('[DownloadModal] SIMKL episodes available:', simklEpisodes?.length || 0);

  const { startDownload, isLoading: isDownloading } = useDownloadStarter({
    onError: error => {
      console.error('Download error:', error);
      // Could show a toast notification here
    },
  });

  const { listTracks, tracks, isLoading: isLoadingTracks } = useTrackListing();

  // Initialize config with normalized country code
  const normalizedCountry = normalizeCountryCode(streamingOffer.country);

  const [config, setConfig] = useState<DownloadConfig>({
    quality: '1080',
    range: 'SDR',
    v_lang: 'original',
    a_lang: 'EN',
    s_lang: 'ALL',
    episodes: {
      mode: 'all',
    },
    proxy: normalizedCountry,
  });

  // Log the country handling for debugging
  console.log('[DownloadModal] Country code handling:', {
    original: streamingOffer.country,
    normalized: normalizedCountry,
    serviceMatch: serviceMatch?.service,
    streamingOffer: {
      url: streamingOffer.standardWebURL,
      service: streamingOffer.package?.clearName,
    },
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedEpisodes, setSelectedEpisodes] = useState<number[]>([]);
  const [aggregatedTracks, setAggregatedTracks] = useState<any>(null);
  const [viewingEpisodeIndex, setViewingEpisodeIndex] = useState(0);

  // Helper to extract episode list from SIMKL data
  const getEpisodesFromSimkl = () => {
    if (!simklEpisodes || simklEpisodes.length === 0) return { seasons: [], episodesBySeasons: {} };

    const episodesBySeasons: Record<number, number[]> = {};
    const seasons: number[] = [];

    simklEpisodes.forEach((ep: any) => {
      const season = ep.season || 1;
      const episode = ep.episode;

      // Skip specials (season 0) unless explicitly included
      if (season === 0 || !episode) return;

      if (!episodesBySeasons[season]) {
        episodesBySeasons[season] = [];
        seasons.push(season);
      }

      if (!episodesBySeasons[season].includes(episode)) {
        episodesBySeasons[season].push(episode);
      }
    });

    // Sort episodes within each season
    Object.keys(episodesBySeasons).forEach(season => {
      episodesBySeasons[Number(season)].sort((a, b) => a - b);
    });

    return { seasons: seasons.sort((a, b) => a - b), episodesBySeasons };
  };

  // Computed tracks that merges API tracks and aggregated tracks from multiple requests
  const effectiveTracks = aggregatedTracks || tracks;

  // Smart track loading function with optional force refresh
  const loadTracksOptimized = async (forceRefresh = false) => {
    if (!serviceMatch?.service) return;

    try {
      console.log('[DownloadModal] Track loading with country:', {
        original: streamingOffer.country,
        normalized: normalizedCountry,
        willUseProxy: normalizedCountry,
        forceRefresh,
        mode: config.episodes.mode,
        selectedEpisodes: selectedEpisodes.length,
      });
      console.log('[DownloadModal] Full streamingOffer:', streamingOffer);

      if (titleInfo.mediaType === 'tv') {
        // Determine which episodes to load based on mode
        const episodesToLoad: Array<{ season: number; episode: number }> = [];

        if (config.episodes.mode === 'specific' && selectedEpisodes.length > 0) {
          // Load tracks for all specifically selected episodes
          const season = config.episodes.season || 1;
          selectedEpisodes.forEach(ep => {
            episodesToLoad.push({ season, episode: ep });
          });
          console.log(
            `[DownloadModal] Loading ${episodesToLoad.length} specific episodes:`,
            episodesToLoad.map(e => `S${e.season}E${e.episode}`).join(', ')
          );
        } else if (
          config.episodes.mode === 'season' &&
          config.episodes.season &&
          simklEpisodes &&
          simklEpisodes.length > 0
        ) {
          // For season mode, load all episodes in the selected season
          const { episodesBySeasons } = getEpisodesFromSimkl();
          const episodeNumbers = episodesBySeasons[config.episodes.season] || [];

          episodeNumbers.forEach(epNum => {
            episodesToLoad.push({ season: config.episodes.season!, episode: epNum });
          });
          console.log(
            `[DownloadModal] Loading all ${episodesToLoad.length} episodes for season ${config.episodes.season}:`,
            episodesToLoad.map(e => `S${e.season}E${e.episode}`).join(', ')
          );
        } else {
          // For 'all' mode or when no SIMKL data, just load one sample episode
          if (simklEpisodes && simklEpisodes.length > 0) {
            const { seasons: availableSeasons, episodesBySeasons } = getEpisodesFromSimkl();
            if (availableSeasons.length > 0) {
              // Use the selected season if available, otherwise use the first season
              const targetSeason =
                config.episodes.season && availableSeasons.includes(config.episodes.season)
                  ? config.episodes.season
                  : availableSeasons[0];
              const firstEpisode = episodesBySeasons[targetSeason]?.[0];
              if (firstEpisode) {
                episodesToLoad.push({ season: targetSeason, episode: firstEpisode });
                console.log(
                  `[DownloadModal] Loading sample episode for all mode: S${targetSeason}E${firstEpisode}`
                );
              }
            }
          }
        }

        if (episodesToLoad.length === 0) {
          // Fallback: let API decide
          console.log('[DownloadModal] No specific episodes determined, using API default');
          await listTracks(serviceMatch.service, streamingOffer.standardWebURL, {
            type: 'all',
            proxy: normalizedCountry,
            forceRefresh,
          });
        } else if (episodesToLoad.length === 1) {
          // Single episode request
          const ep = episodesToLoad[0];
          const seasonStr = String(ep.season).padStart(2, '0');
          const episodeStr = String(ep.episode).padStart(2, '0');
          console.log(`[DownloadModal] Loading S${seasonStr}E${episodeStr} for track info`);
          await listTracks(serviceMatch.service, streamingOffer.standardWebURL, {
            type: 'episode',
            season: ep.season,
            episode: ep.episode,
            proxy: normalizedCountry,
            forceRefresh,
          });
        } else {
          // Multiple episodes: load them sequentially
          console.log(`[DownloadModal] Loading ${episodesToLoad.length} episodes sequentially...`);
          const allEpisodeData: any[] = [];

          for (const ep of episodesToLoad) {
            const seasonStr = String(ep.season).padStart(2, '0');
            const episodeStr = String(ep.episode).padStart(2, '0');
            console.log(`[DownloadModal] Loading S${seasonStr}E${episodeStr}...`);

            try {
              const episodeData = await listTracks(
                serviceMatch.service,
                streamingOffer.standardWebURL,
                {
                  type: 'episode',
                  season: ep.season,
                  episode: ep.episode,
                  proxy: normalizedCountry,
                  forceRefresh,
                }
              );

              // Collect episode data
              if (episodeData.episodes && episodeData.episodes.length > 0) {
                allEpisodeData.push(...episodeData.episodes);
              }

              console.log(`[DownloadModal] ✓ Loaded S${seasonStr}E${episodeStr}`);
            } catch (err) {
              console.error(`[DownloadModal] ✗ Failed to load S${seasonStr}E${episodeStr}:`, err);
              // Continue with next episode even if one fails
            }
          }

          console.log(`[DownloadModal] Loaded ${allEpisodeData.length} episodes total`);

          // Update aggregated tracks state with all collected episodes
          if (allEpisodeData.length > 0) {
            setAggregatedTracks({ episodes: allEpisodeData });
          }
        }

        console.log('[DownloadModal] Track loading complete');
      } else {
        // For movies: Load all tracks (there's only one "episode")
        console.log('[DownloadModal] Loading movie tracks');
        await listTracks(serviceMatch.service, streamingOffer.standardWebURL, {
          type: 'all',
          proxy: normalizedCountry,
          forceRefresh,
        });
      }
    } catch (err) {
      console.error('Failed to load tracks:', err);
    }
  };

  // Initialize episode selection when component opens (only if not already set)
  useEffect(() => {
    if (titleInfo.mediaType !== 'tv') return;

    // Skip if user has already made selections (mode is set and season is set)
    if (config.episodes.season) return;

    // If we have tracks, use them
    if (effectiveTracks?.episodes && effectiveTracks.episodes.length > 1) {
      const firstSeason = Math.min(...effectiveTracks.episodes.map(ep => ep.season));
      setConfig(prev => ({
        ...prev,
        episodes: {
          mode: 'season',
          season: firstSeason,
        },
      }));
    }
    // Otherwise if we have SIMKL data, use it to initialize
    else if (simklEpisodes && simklEpisodes.length > 0 && !effectiveTracks?.episodes) {
      const { seasons: availableSeasons } = getEpisodesFromSimkl();
      if (availableSeasons.length > 0) {
        setConfig(prev => ({
          ...prev,
          episodes: {
            mode: 'season',
            season: availableSeasons[0],
          },
        }));
      }
    }
  }, [effectiveTracks, simklEpisodes, titleInfo.mediaType, config.episodes.season]);

  const handleConfigChange = (key: keyof DownloadConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value,
    }));

    // Clear aggregated tracks when episode mode changes to avoid showing stale data
    if (key === 'episodes' && aggregatedTracks) {
      const newMode = (value as any).mode;
      const oldMode = config.episodes.mode;
      if (newMode !== oldMode) {
        console.log('[DownloadModal] Episode mode changed, clearing aggregated tracks');
        setAggregatedTracks(null);
      }
    }
  };

  const handleEpisodeSelection = (episodeNumber: number, checked: boolean) => {
    setSelectedEpisodes(prev =>
      checked
        ? [...prev, episodeNumber].sort((a, b) => a - b)
        : prev.filter(ep => ep !== episodeNumber)
    );
  };

  const handleDownload = async () => {
    if (!serviceMatch?.service) return;

    // Ensure we're using a valid, normalized country code for proxy
    const proxyCountry = normalizeCountryCode(config.proxy);

    // Build wanted parameter for episode selection
    // Format must be S01E01 (capital S and E with zero-padded numbers)
    let wanted: string | undefined;
    if (titleInfo.mediaType === 'tv') {
      if (config.episodes.mode === 'specific' && selectedEpisodes.length > 0) {
        const season = config.episodes.season || 1;
        wanted = selectedEpisodes
          .map(ep => {
            const seasonStr = String(season).padStart(2, '0');
            const episodeStr = String(ep).padStart(2, '0');
            return `S${seasonStr}E${episodeStr}`;
          })
          .join(',');
      } else if (config.episodes.mode === 'season' && config.episodes.season) {
        // For season mode, send just the season (e.g., S01) which downloads all episodes in that season
        const seasonStr = String(config.episodes.season).padStart(2, '0');
        wanted = `S${seasonStr}`;
      }
      // For 'all' mode, don't send wanted parameter (API will download all)
    }

    const request: DownloadRequest = {
      service: serviceMatch.service,
      url: streamingOffer.standardWebURL,
      quality: config.quality,
      range: config.range,
      v_lang: config.v_lang === 'original' ? undefined : config.v_lang,
      a_lang: config.a_lang,
      s_lang: config.s_lang,
      tmdb_id: titleInfo.tmdbId,
      wanted: wanted,
      proxy: proxyCountry,
      profile: config.profile,
    };

    console.log('[DownloadModal] Starting download with request:', {
      service: request.service,
      proxy: request.proxy,
      quality: request.quality,
      url: request.url,
      wanted: request.wanted,
      wantedFormat: 'S01E01 format (capital S and E, zero-padded)',
    });

    try {
      await startDownload(request);
      onClose();
    } catch (error) {
      console.error('Failed to start download:', error);
    }
  };

  const getEpisodesByMode = () => {
    // If we have SIMKL episode data and no tracks loaded yet, use SIMKL data for episode selection
    if (
      titleInfo.mediaType === 'tv' &&
      simklEpisodes &&
      simklEpisodes.length > 0 &&
      !effectiveTracks?.episodes
    ) {
      const { episodesBySeasons } = getEpisodesFromSimkl();
      const season = config.episodes.season || Object.keys(episodesBySeasons)[0];

      if (config.episodes.mode === 'season' || config.episodes.mode === 'specific') {
        const episodeNumbers = episodesBySeasons[Number(season)] || [];
        return episodeNumbers.map(episodeNum => ({
          season: Number(season),
          episode: episodeNum,
          title: undefined,
          video_tracks: [],
          audio_tracks: [],
          subtitle_tracks: [],
        }));
      }

      // For 'all' mode, return all episodes from all seasons
      return Object.entries(episodesBySeasons).flatMap(([seasonNum, episodes]) =>
        episodes.map(episodeNum => ({
          season: Number(seasonNum),
          episode: episodeNum,
          title: undefined,
          video_tracks: [],
          audio_tracks: [],
          subtitle_tracks: [],
        }))
      );
    }

    // Otherwise use loaded track data
    if (!effectiveTracks?.episodes) return [];

    switch (config.episodes.mode) {
      case 'season':
        return effectiveTracks.episodes.filter(ep =>
          config.episodes.season ? ep.season === config.episodes.season : true
        );
      case 'specific':
        return effectiveTracks.episodes.filter(ep =>
          config.episodes.season ? ep.season === config.episodes.season : true
        );
      default:
        return effectiveTracks.episodes;
    }
  };

  const selectedEpisodesForDisplay = getEpisodesByMode();

  // Get seasons from either tracks or SIMKL data
  const seasons = (() => {
    if (effectiveTracks?.episodes) {
      return [...new Set(effectiveTracks.episodes.map(ep => ep.season))].sort((a, b) => a - b);
    }
    if (titleInfo.mediaType === 'tv' && simklEpisodes && simklEpisodes.length > 0) {
      const { seasons: simklSeasons } = getEpisodesFromSimkl();
      return simklSeasons;
    }
    return [];
  })();

  // Get total episode count for display
  const totalEpisodeCount = (() => {
    if (effectiveTracks?.episodes) {
      return effectiveTracks.episodes.length;
    }
    if (titleInfo.mediaType === 'tv' && simklEpisodes && simklEpisodes.length > 0) {
      // Count only regular episodes (not specials)
      return simklEpisodes.filter((ep: any) => ep.season && ep.season > 0).length;
    }
    return 0;
  })();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Configuration
          </DialogTitle>
          <DialogDescription>
            Configure download settings for "{titleInfo.title}" from{' '}
            {serviceMatch?.service || 'Unknown Service'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 p-1">
            {/* Service Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Source Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{serviceMatch?.service}</Badge>
                  <Badge variant="secondary">{streamingOffer.package?.clearName}</Badge>
                  <Badge variant="outline">{titleInfo.mediaType.toUpperCase()}</Badge>
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1"
                  >
                    <CountryFlag
                      countryCode={normalizedCountry}
                      title={`Using ${normalizedCountry.toUpperCase()} proxy`}
                      className="w-3 h-2"
                    />
                    Proxy: {normalizedCountry.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{streamingOffer.standardWebURL}</p>
                <p className="text-xs text-muted-foreground">
                  Downloads will use <strong>{normalizedCountry.toUpperCase()}</strong> region proxy
                  for content access
                </p>
              </CardContent>
            </Card>

            {/* Quality Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Video Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={config.quality}
                  onValueChange={value => handleConfigChange('quality', value)}
                  className="grid grid-cols-2 gap-3"
                >
                  {QUALITY_OPTIONS.map(option => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`quality-${option.value}`} />
                      <Label htmlFor={`quality-${option.value}`} className="flex-1">
                        <div className="flex flex-col">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <Label className="text-sm font-medium">HDR/Dynamic Range</Label>
                  <RadioGroup
                    value={config.range}
                    onValueChange={value => handleConfigChange('range', value)}
                    className="flex gap-6"
                  >
                    {HDR_OPTIONS.map(option => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`hdr-${option.value}`} />
                        <Label htmlFor={`hdr-${option.value}`}>
                          <div className="flex flex-col">
                            <span className="font-medium">{option.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>

            {/* Audio & Subtitle Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Volume2 className="h-4 w-4" />
                  Audio & Subtitles
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Audio Language</Label>
                    <RadioGroup
                      value={config.a_lang}
                      onValueChange={value => handleConfigChange('a_lang', value)}
                    >
                      {AUDIO_LANGUAGE_OPTIONS.map(option => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.value} id={`audio-${option.value}`} />
                          <Label htmlFor={`audio-${option.value}`}>{option.label}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Subtitles</Label>
                    <RadioGroup
                      value={config.s_lang}
                      onValueChange={value => handleConfigChange('s_lang', value)}
                    >
                      {SUBTITLE_OPTIONS.map(option => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.value} id={`subtitle-${option.value}`} />
                          <Label htmlFor={`subtitle-${option.value}`}>{option.label}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Episode Selection for TV Shows */}
            {titleInfo.mediaType === 'tv' && totalEpisodeCount > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <List className="h-4 w-4" />
                    Episode Selection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!effectiveTracks?.episodes && simklEpisodes && simklEpisodes.length > 0 && (
                    <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded border border-blue-200 dark:border-blue-800">
                      Showing all available episodes from metadata. Load track info to see available
                      qualities.
                    </div>
                  )}
                  <RadioGroup
                    value={config.episodes.mode}
                    onValueChange={(value: 'all' | 'season' | 'specific') =>
                      handleConfigChange('episodes', { ...config.episodes, mode: value })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="episodes-all" />
                      <Label htmlFor="episodes-all">
                        Download all episodes ({totalEpisodeCount} total)
                      </Label>
                    </div>

                    {seasons.length > 1 && (
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="season" id="episodes-season" />
                        <Label htmlFor="episodes-season">Download specific season</Label>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="specific" id="episodes-specific" />
                      <Label htmlFor="episodes-specific">Select specific episodes</Label>
                    </div>
                  </RadioGroup>

                  {config.episodes.mode === 'season' && seasons.length > 1 && (
                    <div className="ml-6 space-y-2">
                      <Label className="text-sm">Select Season:</Label>
                      <RadioGroup
                        value={config.episodes.season?.toString()}
                        onValueChange={value =>
                          handleConfigChange('episodes', {
                            ...config.episodes,
                            season: parseInt(value),
                          })
                        }
                        className="flex flex-wrap gap-4"
                      >
                        {seasons.map(season => {
                          const episodeCount =
                            selectedEpisodesForDisplay.filter(ep => ep.season === season).length ||
                            (simklEpisodes
                              ? simklEpisodes.filter((ep: any) => ep.season === season).length
                              : 0);
                          return (
                            <div key={season} className="flex items-center space-x-2">
                              <RadioGroupItem value={season.toString()} id={`season-${season}`} />
                              <Label htmlFor={`season-${season}`}>
                                Season {season} ({episodeCount} episodes)
                              </Label>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    </div>
                  )}

                  {config.episodes.mode === 'specific' && (
                    <div className="ml-6 space-y-3">
                      {seasons.length > 1 && (
                        <div>
                          <Label className="text-sm">Season:</Label>
                          <RadioGroup
                            value={config.episodes.season?.toString() || seasons[0].toString()}
                            onValueChange={value =>
                              handleConfigChange('episodes', {
                                ...config.episodes,
                                season: parseInt(value),
                              })
                            }
                            className="flex flex-wrap gap-4 mt-2"
                          >
                            {seasons.map(season => (
                              <div key={season} className="flex items-center space-x-2">
                                <RadioGroupItem
                                  value={season.toString()}
                                  id={`select-season-${season}`}
                                />
                                <Label htmlFor={`select-season-${season}`}>Season {season}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      )}

                      <div>
                        <Label className="text-sm">Episodes:</Label>
                        <div className="grid grid-cols-4 gap-2 mt-2 max-h-32 overflow-y-auto">
                          {selectedEpisodesForDisplay.map(episode => (
                            <div
                              key={`${episode.season}-${episode.episode}`}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`episode-${episode.season}-${episode.episode}`}
                                checked={selectedEpisodes.includes(episode.episode)}
                                onCheckedChange={checked =>
                                  handleEpisodeSelection(episode.episode, !!checked)
                                }
                              />
                              <Label
                                htmlFor={`episode-${episode.season}-${episode.episode}`}
                                className="text-xs"
                              >
                                E{episode.episode}
                              </Label>
                            </div>
                          ))}
                        </div>
                        {config.episodes.mode === 'specific' && selectedEpisodes.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Selected: {selectedEpisodes.length} episode
                            {selectedEpisodes.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Available Tracks Info */}
            {isLoadingTracks && (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Loading available tracks...
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isLoadingTracks && !effectiveTracks && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <List className="h-4 w-4" />
                    Available Tracks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Load track information to see available video qualities, HDR options, audio
                      languages, and subtitles.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => loadTracksOptimized(false)}
                      disabled={isLoadingTracks || !serviceMatch?.service}
                    >
                      <List className="h-4 w-4 mr-2" />
                      Load Track Information
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {effectiveTracks?.episodes && effectiveTracks.episodes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <List className="h-4 w-4" />
                      Available Tracks
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadTracksOptimized(true)}
                      disabled={isLoadingTracks}
                    >
                      {isLoadingTracks ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <List className="h-3 w-3 mr-1" />
                      )}
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Episode Tab Navigation (if multiple episodes loaded) */}
                    {effectiveTracks.episodes.length > 1 && (
                      <div className="border-b pb-2">
                        <div className="flex flex-wrap gap-2">
                          {effectiveTracks.episodes.map((ep, idx) => (
                            <Badge
                              key={idx}
                              variant={viewingEpisodeIndex === idx ? 'default' : 'outline'}
                              className={`cursor-pointer text-xs ${
                                viewingEpisodeIndex === idx
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-secondary'
                              }`}
                              onClick={() => setViewingEpisodeIndex(idx)}
                            >
                              S{ep.season}E{ep.episode}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {(() => {
                      const episode = effectiveTracks.episodes[viewingEpisodeIndex];
                      if (!episode) return null;

                      return (
                        <div className="space-y-4">
                          {/* Episode Title */}
                          {episode.title && (
                            <div className="text-sm font-medium">{episode.title}</div>
                          )}

                          {/* Video Tracks */}
                          {episode.video_tracks.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Monitor className="h-3 w-3" />
                                <span className="text-sm font-medium">Video Qualities</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {deduplicateVideoTracks(episode.video_tracks).map(
                                  (track, trackIdx) => {
                                    // Format FPS to remove excessive decimals (e.g., 23.976023976023978 -> 23.98)
                                    const fpsDisplay = track.fps
                                      ? Math.round(track.fps * 100) / 100
                                      : null;

                                    return (
                                      <Badge key={trackIdx} variant="outline" className="text-xs">
                                        {track.resolution || 'Unknown'}
                                        {track.codec_display && ` ${track.codec_display}`}
                                        {track.range_display && ` ${track.range_display}`}
                                        {fpsDisplay && ` @${fpsDisplay}fps`}
                                      </Badge>
                                    );
                                  }
                                )}
                              </div>
                            </div>
                          )}

                          {/* Audio Tracks */}
                          {episode.audio_tracks.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Volume2 className="h-3 w-3" />
                                <span className="text-sm font-medium">Audio Languages</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {deduplicateAudioTracks(episode.audio_tracks).map(
                                  (track, trackIdx) => (
                                    <Badge key={trackIdx} variant="outline" className="text-xs">
                                      {track.language || 'Unknown'}
                                      {track.codec_display && ` ${track.codec_display}`}
                                      {track.channels && ` ${track.channels}ch`}
                                      {track.bitrate && ` ${Math.round(track.bitrate)}kbps`}
                                      {track.atmos && ` Atmos`}
                                    </Badge>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                          {/* Subtitle Tracks */}
                          {episode.subtitle_tracks.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Subtitles className="h-3 w-3" />
                                <span className="text-sm font-medium">Subtitles</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {deduplicateSubtitleTracks(episode.subtitle_tracks).map(
                                  (track, trackIdx) => {
                                    const flags = [];
                                    if (track.forced) flags.push('Forced');
                                    if (track.sdh) flags.push('SDH');
                                    if (track.cc) flags.push('CC');
                                    const flagText =
                                      flags.length > 0 ? ` [${flags.join(', ')}]` : '';

                                    return (
                                      <Badge key={trackIdx} variant="outline" className="text-xs">
                                        {track.language || 'Unknown'}
                                        {flagText}
                                      </Badge>
                                    );
                                  }
                                )}
                              </div>
                            </div>
                          )}

                          {titleInfo.mediaType === 'tv' && effectiveTracks.episodes.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {(() => {
                                const seasons = [
                                  ...new Set(effectiveTracks.episodes.map(ep => ep.season)),
                                ];
                                const totalEpisodes = effectiveTracks.episodes.length;

                                return (
                                  <>
                                    Loaded {totalEpisodes} episode{totalEpisodes !== 1 ? 's' : ''}{' '}
                                    with track information.
                                    {seasons.length > 1 && (
                                      <span>
                                        {' '}
                                        Seasons: {seasons.sort((a, b) => a - b).join(', ')}
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDownloading}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isDownloading || !serviceMatch?.service || !effectiveTracks}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {isDownloading
              ? 'Starting Download...'
              : !effectiveTracks
                ? 'Load Tracks First'
                : 'Start Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
