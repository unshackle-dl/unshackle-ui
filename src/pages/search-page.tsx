import { useState, useCallback, useEffect } from 'react';
import { Grid, List, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SearchHero } from '@/components/search/search-hero';
import { ContentGrid } from '@/components/search/content-grid';
import { DownloadOptionsModal } from '@/components/downloads/download-options-modal';
import { useSearchStore } from '@/stores/search-store';
import { useServicesStore } from '@/stores/services-store';
import { useDownloadsStore } from '@/stores/downloads-store';
import { unshackleClient } from '@/lib/api';
import { type EnhancedSearchResult, type DownloadOptions } from '@/lib/types';

export function SearchPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedResult, setSelectedResult] = useState<EnhancedSearchResult | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  
  const {
    tmdbQuery,
    tmdbLoading,
    selectedServices,
    aggregatedResults,
    aggregationLoading,
    setTmdbQuery,
    setSelectedServices,
    // Actions would be implemented with API integration
  } = useSearchStore();
  
  const { 
    services, 
    loading: servicesLoading, 
    setServices, 
    setLoading: setServicesLoading, 
    setError: setServicesError,
    needsRefresh 
  } = useServicesStore();
  const { addJob } = useDownloadsStore();

  // Load services on component mount or when refresh is needed
  useEffect(() => {
    const loadServices = async () => {
      if (services.length === 0 || needsRefresh()) {
        try {
          setServicesLoading(true);
          setServicesError(null);
          const fetchedServices = await unshackleClient.getServices();
          setServices(fetchedServices);
        } catch (error) {
          console.error('Failed to load services:', error);
          setServicesError(error instanceof Error ? error.message : 'Failed to load services');
        } finally {
          setServicesLoading(false);
        }
      }
    };

    loadServices();
  }, [services.length, needsRefresh, setServices, setServicesLoading, setServicesError]);
  
  const handleSearch = useCallback(async (query: string) => {
    setTmdbQuery(query);
    // TODO: Implement TMDB search and Unshackle service search
    console.log('Searching for:', query, 'on services:', selectedServices);
  }, [selectedServices, setTmdbQuery]);
  
  const handleServiceChange = useCallback((services: string[]) => {
    setSelectedServices(services);
  }, [setSelectedServices]);
  
  const handleDownload = useCallback(async (result: EnhancedSearchResult) => {
    setSelectedResult(result);
    setShowDownloadModal(true);
  }, []);
  
  const handleDownloadConfirm = useCallback(async (options: DownloadOptions) => {
    if (!selectedResult) return;
    
    // Create a new download job
    const job = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      service: selectedResult.unshackleResult.service,
      content_id: selectedResult.unshackleResult.id,
      content_title: selectedResult.displayTitle,
      status: 'queued' as const,
      start_time: new Date().toISOString(),
    };
    
    addJob(job);
    
    // TODO: Implement actual API call to start download
    console.log('Starting download with options:', options);
    
    setSelectedResult(null);
  }, [selectedResult, addJob]);
  
  const isLoading = tmdbLoading || aggregationLoading;
  const hasResults = aggregatedResults.length > 0;
  
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
                  Found {aggregatedResults.length} results for "{tmdbQuery}"
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
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Results Grid */}
          {hasResults && !isLoading && (
            <ContentGrid
              results={aggregatedResults}
              onDownload={handleDownload}
              viewMode={viewMode}
            />
          )}
        </div>
      )}
      
      {/* Empty State */}
      {!hasResults && !isLoading && tmdbQuery && (
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
            setShowDownloadModal(false);
            setSelectedResult(null);
          }}
          onConfirm={handleDownloadConfirm}
          result={selectedResult}
        />
      )}
    </div>
  );
}