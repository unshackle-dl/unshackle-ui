import { useState, useCallback } from 'react';
import { Grid, List, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SearchHero } from '@/components/search/search-hero';
import { ContentGrid } from '@/components/search/content-grid';
import { DownloadOptionsModal } from '@/components/downloads/download-options-modal';
import { useSearchStore } from '@/stores/search-store';
import { useServicesStore } from '@/stores/services-store';
import { useDownloadsStore } from '@/stores/downloads-store';
import { useEnhancedSearch } from '@/hooks/use-enhanced-search';
import { useStartDownload } from '@/lib/api/queries';
import { type EnhancedSearchResult, type DownloadOptions } from '@/lib/types';

export function SearchPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedResult, setSelectedResult] = useState<EnhancedSearchResult | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(false);
  
  const {
    selectedServices,
    selectedContentTypes,
    setSelectedServices,
    addToSearchHistory,
  } = useSearchStore();
  
  const { 
    services, 
    loading: servicesLoading
  } = useServicesStore();
  const { addJob } = useDownloadsStore();
  const startDownloadMutation = useStartDownload();

  // Enhanced search with TMDB integration
  const {
    results: enhancedResults,
    isLoading: searchLoading,
    error: searchError,
  } = useEnhancedSearch({
    query: searchQuery,
    services: selectedServices,
    contentTypes: selectedContentTypes,
    enabled: searchEnabled,
  });

  // Services are automatically loaded via the useServices hook in the main app
  
  const handleSearch = useCallback((query: string) => {
    if (!query.trim() || selectedServices.length === 0) return;
    
    setSearchQuery(query);
    setSearchEnabled(true);
    
    // Add to search history when search is initiated
    addToSearchHistory(query, 0); // We'll update with actual count when results come in
  }, [selectedServices, addToSearchHistory]);
  
  const handleServiceChange = useCallback((services: string[]) => {
    setSelectedServices(services);
  }, [setSelectedServices]);
  
  const handleDownload = useCallback(async (result: EnhancedSearchResult) => {
    setSelectedResult(result);
    setShowDownloadModal(true);
  }, []);
  
  const handleDownloadConfirm = useCallback(async (options: DownloadOptions) => {
    if (!selectedResult) return;
    
    try {
      // Start the download using the API
      const jobId = await startDownloadMutation.mutateAsync({
        service: selectedResult.unshackleResult.service,
        content_id: selectedResult.unshackleResult.id,
        quality: options.quality,
        hdr10: options.hdr10,
        dolby_vision: options.dolby_vision,
        atmos: options.atmos,
        subtitles: options.subtitles,
        audio_tracks: options.audio_tracks,
      });
      
      // Create a local job entry for immediate UI feedback
      const job = {
        id: jobId,
        service: selectedResult.unshackleResult.service,
        content_id: selectedResult.unshackleResult.id,
        content_title: selectedResult.displayTitle,
        status: 'queued' as const,
        start_time: new Date().toISOString(),
        progress: 0,
      };
      
      addJob(job);
      
      // Add to search history to update with successful download initiation
      addToSearchHistory(searchQuery, enhancedResults.length);
      
    } catch (error) {
      console.error('Failed to start download:', error);
      // Error is handled by the mutation's onError callback
    } finally {
      setSelectedResult(null);
      setShowDownloadModal(false);
    }
  }, [selectedResult, startDownloadMutation, addJob, addToSearchHistory, searchQuery, enhancedResults.length]);
  
  const isLoading = searchLoading;
  const hasResults = enhancedResults.length > 0;
  
  return (
    <div className="space-y-6">
      {/* Search Hero Section */}
      <SearchHero
        onSearch={handleSearch}
        onServiceChange={handleServiceChange}
        services={services}
        selectedServices={selectedServices}
        servicesLoading={servicesLoading}
      />
      
      {/* Results Section */}
      {(hasResults || isLoading) && (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div>
              {hasResults && (
                <p className="text-sm text-muted-foreground">
                  Found {enhancedResults.length} results for "{searchQuery}"
                </p>
              )}
            </div>
            
            {hasResults && (
              <div className="flex items-center space-x-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          {/* Loading State */}
          {isLoading && (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                  <p className="text-muted-foreground">Searching across services...</p>
                  <p className="text-xs text-muted-foreground">
                    Searching {selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''} and enriching with TMDB data
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {searchError && !isLoading && (
            <Card>
              <CardContent className="text-center py-12">
                <div className="space-y-2">
                  <p className="text-lg font-medium text-destructive">Search Error</p>
                  <p className="text-muted-foreground">{searchError}</p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchEnabled(false);
                      setTimeout(() => setSearchEnabled(true), 100);
                    }}
                  >
                    Retry Search
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Results Grid */}
          {hasResults && !isLoading && (
            <ContentGrid
              results={enhancedResults}
              onDownload={handleDownload}
              viewMode={viewMode}
            />
          )}
        </div>
      )}
      
      {/* Empty State */}
      {!hasResults && !isLoading && searchQuery && (
        <Card>
          <CardContent className="text-center py-12">
            <div className="space-y-2">
              <p className="text-lg font-medium">No results found</p>
              <p className="text-muted-foreground">
                Try adjusting your search terms or selecting different services
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Download Options Modal */}
      {selectedResult && (
        <DownloadOptionsModal
          isOpen={showDownloadModal}
          onClose={() => {
            if (!startDownloadMutation.isPending) {
              setShowDownloadModal(false);
              setSelectedResult(null);
            }
          }}
          onConfirm={handleDownloadConfirm}
          result={selectedResult}
          isLoading={startDownloadMutation.isPending}
        />
      )}
    </div>
  );
}