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
  X 
} from 'lucide-react';
import { useDownloadStarter, useTrackListing } from '@/lib/hooks/use-download';
import { DownloadRequest, TrackInfo, EpisodeInfo } from '@/lib/services/unshackle-api';
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
  titleInfo 
}: DownloadModalProps) {
  const { startDownload, isLoading: isDownloading } = useDownloadStarter({
    onError: (error) => {
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
      mode: 'all'
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
      service: streamingOffer.package?.clearName
    }
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedEpisodes, setSelectedEpisodes] = useState<number[]>([]);
  
  // Smart track loading function
  const loadTracksOptimized = async () => {
    if (!serviceMatch?.service) return;

    try {
      console.log('[DownloadModal] Track loading with country:', {
        original: streamingOffer.country,
        normalized: normalizedCountry,
        willUseProxy: normalizedCountry
      });
      console.log('[DownloadModal] Full streamingOffer:', streamingOffer);
      
      if (titleInfo.mediaType === 'tv') {
        // For TV shows: First get all episodes to find the latest season, then load that season's first episode
        console.log('[DownloadModal] Loading TV show tracks - getting season info first');
        const allEpisodes = await listTracks(serviceMatch.service, streamingOffer.standardWebURL, {
          type: 'all',
          proxy: normalizedCountry
        });

        if (allEpisodes?.episodes && allEpisodes.episodes.length > 0) {
          // Find the latest (highest) season number
          const latestSeason = Math.max(...allEpisodes.episodes.map(ep => ep.season));
          console.log('[DownloadModal] Latest season detected:', latestSeason);
          
          // Now load just the latest season for detailed track info
          await listTracks(serviceMatch.service, streamingOffer.standardWebURL, {
            type: 'season',
            season: latestSeason,
            proxy: normalizedCountry
          });
          
          console.log('[DownloadModal] Loaded tracks for latest season:', latestSeason);
        }
      } else {
        // For movies: Load all tracks (there's only one "episode")
        console.log('[DownloadModal] Loading movie tracks');
        await listTracks(serviceMatch.service, streamingOffer.standardWebURL, {
          type: 'all',
          proxy: normalizedCountry
        });
      }
    } catch (err) {
      console.error('Failed to load tracks:', err);
    }
  };

  // Update episode selection mode when tracks change
  useEffect(() => {
    if (tracks?.episodes && tracks.episodes.length > 1) {
      // If multiple episodes detected, default to season mode for the first season
      const firstSeason = Math.min(...tracks.episodes.map(ep => ep.season));
      setConfig(prev => ({
        ...prev,
        episodes: {
          mode: 'season',
          season: firstSeason
        }
      }));
    }
  }, [tracks]);

  const handleConfigChange = (key: keyof DownloadConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
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

    const request: DownloadRequest = {
      service: serviceMatch.service,
      url: streamingOffer.standardWebURL,
      quality: config.quality,
      range: config.range,
      v_lang: config.v_lang === 'original' ? undefined : config.v_lang,
      a_lang: config.a_lang,
      s_lang: config.s_lang,
      tmdb_id: titleInfo.tmdbId,
      episodes: config.episodes.mode === 'specific' ? {
        ...config.episodes,
        list: selectedEpisodes
      } : config.episodes,
      proxy: proxyCountry,
      profile: config.profile,
    };

    console.log('[DownloadModal] Starting download with request:', {
      service: request.service,
      proxy: request.proxy,
      quality: request.quality,
      url: request.url,
      episodes: request.episodes
    });

    try {
      await startDownload(request);
      onClose();
    } catch (error) {
      console.error('Failed to start download:', error);
    }
  };

  const getEpisodesByMode = () => {
    if (!tracks?.episodes) return [];

    switch (config.episodes.mode) {
      case 'season':
        return tracks.episodes.filter(ep => 
          config.episodes.season ? ep.season === config.episodes.season : true
        );
      case 'specific':
        return tracks.episodes.filter(ep => 
          config.episodes.season ? ep.season === config.episodes.season : true
        );
      default:
        return tracks.episodes;
    }
  };

  const selectedEpisodesForDisplay = getEpisodesByMode();
  const seasons = tracks?.episodes ? 
    [...new Set(tracks.episodes.map(ep => ep.season))].sort((a, b) => a - b) : [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Configuration
          </DialogTitle>
          <DialogDescription>
            Configure download settings for "{titleInfo.title}" from {serviceMatch?.service || 'Unknown Service'}
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
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
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
                  Downloads will use <strong>{normalizedCountry.toUpperCase()}</strong> region proxy for content access
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
                  onValueChange={(value) => handleConfigChange('quality', value)}
                  className="grid grid-cols-2 gap-3"
                >
                  {QUALITY_OPTIONS.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`quality-${option.value}`} />
                      <Label htmlFor={`quality-${option.value}`} className="flex-1">
                        <div className="flex flex-col">
                          <span className="font-medium">{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.description}</span>
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
                    onValueChange={(value) => handleConfigChange('range', value)}
                    className="flex gap-6"
                  >
                    {HDR_OPTIONS.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`hdr-${option.value}`} />
                        <Label htmlFor={`hdr-${option.value}`}>
                          <div className="flex flex-col">
                            <span className="font-medium">{option.label}</span>
                            <span className="text-xs text-muted-foreground">{option.description}</span>
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
                      onValueChange={(value) => handleConfigChange('a_lang', value)}
                    >
                      {AUDIO_LANGUAGE_OPTIONS.map((option) => (
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
                      onValueChange={(value) => handleConfigChange('s_lang', value)}
                    >
                      {SUBTITLE_OPTIONS.map((option) => (
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
            {titleInfo.mediaType === 'tv' && tracks?.episodes && tracks.episodes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <List className="h-4 w-4" />
                    Episode Selection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup
                    value={config.episodes.mode}
                    onValueChange={(value: 'all' | 'season' | 'specific') => 
                      handleConfigChange('episodes', { ...config.episodes, mode: value })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="episodes-all" />
                      <Label htmlFor="episodes-all">Download all episodes ({tracks.episodes.length} total)</Label>
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
                        onValueChange={(value) => 
                          handleConfigChange('episodes', { 
                            ...config.episodes, 
                            season: parseInt(value) 
                          })
                        }
                        className="flex flex-wrap gap-4"
                      >
                        {seasons.map((season) => (
                          <div key={season} className="flex items-center space-x-2">
                            <RadioGroupItem value={season.toString()} id={`season-${season}`} />
                            <Label htmlFor={`season-${season}`}>
                              Season {season} ({tracks.episodes.filter(ep => ep.season === season).length} episodes)
                            </Label>
                          </div>
                        ))}
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
                            onValueChange={(value) => 
                              handleConfigChange('episodes', { 
                                ...config.episodes, 
                                season: parseInt(value) 
                              })
                            }
                            className="flex flex-wrap gap-4 mt-2"
                          >
                            {seasons.map((season) => (
                              <div key={season} className="flex items-center space-x-2">
                                <RadioGroupItem value={season.toString()} id={`select-season-${season}`} />
                                <Label htmlFor={`select-season-${season}`}>Season {season}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      )}

                      <div>
                        <Label className="text-sm">Episodes:</Label>
                        <div className="grid grid-cols-4 gap-2 mt-2 max-h-32 overflow-y-auto">
                          {selectedEpisodesForDisplay.map((episode) => (
                            <div key={`${episode.season}-${episode.episode}`} className="flex items-center space-x-2">
                              <Checkbox
                                id={`episode-${episode.season}-${episode.episode}`}
                                checked={selectedEpisodes.includes(episode.episode)}
                                onCheckedChange={(checked) => 
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
                            Selected: {selectedEpisodes.length} episode{selectedEpisodes.length !== 1 ? 's' : ''}
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
                    <span className="text-sm text-muted-foreground">Loading available tracks...</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isLoadingTracks && !tracks && (
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
                      Load track information to see available video qualities, HDR options, audio languages, and subtitles.
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={loadTracksOptimized}
                      disabled={isLoadingTracks || !serviceMatch?.service}
                    >
                      <List className="h-4 w-4 mr-2" />
                      Load Track Information
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {tracks?.episodes && tracks.episodes.length > 0 && (
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
                      onClick={loadTracksOptimized}
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
                    {tracks.episodes.slice(0, 1).map((episode, idx) => (
                      <div key={idx} className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {titleInfo.mediaType === 'tv' ? 
                              `S${episode.season}E${episode.episode}` : 
                              'Movie'
                            }
                          </Badge>
                          {episode.title && (
                            <span className="text-sm font-medium">{episode.title}</span>
                          )}
                        </div>

                        {/* Video Tracks */}
                        {episode.video_tracks.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Monitor className="h-3 w-3" />
                              <span className="text-sm font-medium">Video Qualities</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {episode.video_tracks.map((track, trackIdx) => (
                                <Badge key={trackIdx} variant="outline" className="text-xs">
                                  {track.resolution || 'Unknown'}
                                  {track.codec && ` (${track.codec})`}
                                  {track.hdr && ` ${track.hdr}`}
                                  {track.fps && ` @${track.fps}fps`}
                                </Badge>
                              ))}
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
                              {episode.audio_tracks.map((track, trackIdx) => (
                                <Badge key={trackIdx} variant="outline" className="text-xs">
                                  {track.language || 'Unknown'}
                                  {track.codec && ` ${track.codec}`}
                                  {track.channels && ` ${track.channels}`}
                                </Badge>
                              ))}
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
                              {episode.subtitle_tracks.map((track, trackIdx) => (
                                <Badge key={trackIdx} variant="outline" className="text-xs">
                                  {track.language || 'Unknown'}
                                  {track.format && ` (${track.format})`}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {titleInfo.mediaType === 'tv' && tracks.episodes.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {(() => {
                              const seasons = [...new Set(tracks.episodes.map(ep => ep.season))];
                              const latestSeason = Math.max(...seasons);
                              const episodeCount = tracks.episodes.filter(ep => ep.season === latestSeason).length;
                              
                              return (
                                <>
                                  Showing tracks for Season {latestSeason} (latest season).
                                  <br />
                                  Season {latestSeason} has {episodeCount} episode{episodeCount !== 1 ? 's' : ''}.
                                  {seasons.length > 1 && (
                                    <span> Available seasons: {seasons.sort((a, b) => a - b).join(', ')}</span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
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
            disabled={isDownloading || !serviceMatch?.service || !tracks}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {isDownloading ? 'Starting Download...' : 
             !tracks ? 'Load Tracks First' : 'Start Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}