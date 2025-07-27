import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SimpleSearchHero } from '@/components/search/simple-search-hero';
import { TMDBSelectionGrid, ServiceSearchStep, ContentGrid } from '@/components/search';
import { DownloadOptionsModal } from '@/components/downloads/download-options-modal';
import { useServices } from '@/lib/api/queries';
import { useTwoStepSearch } from '@/hooks/use-two-step-search';
import type { EnhancedSearchResult, DownloadOptions } from '@/lib/types';

export function SearchPage() {
  const [selectedResult, setSelectedResult] = useState<EnhancedSearchResult | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Load services
  const { data: services = [] } = useServices();

  // Two-step search workflow
  const {
    searchState,
    tmdbResults,
    tmdbLoading,
    tmdbError,
    serviceResults,
    serviceLoading,
    startSearch,
    selectTMDBResult,
    searchServices,
    resetSearch,
    backToTMDBSelection,
    retryTMDBSearch,
  } = useTwoStepSearch();

  const handleDownload = (result: EnhancedSearchResult) => {
    setSelectedResult(result);
    setShowDownloadModal(true);
  };

  const handleDownloadSubmit = async (options: DownloadOptions) => {
    if (!selectedResult) return;
    
    // TODO: Implement download functionality
    console.log('Download:', selectedResult, options);
    setShowDownloadModal(false);
    setSelectedResult(null);
  };

  const renderCurrentStep = () => {
    switch (searchState.step) {
      case 'initial':
        return (
          <SimpleSearchHero
            onSearch={startSearch}
            isLoading={false}
            disabled={false}
            placeholder="Search for movies and TV shows..."
          />
        );

      case 'tmdb_selection':
        return (
          <div className="space-y-6">
            <SimpleSearchHero
              onSearch={startSearch}
              isLoading={tmdbLoading}
              disabled={false}
              placeholder="Search for movies and TV shows..."
              defaultValue={searchState.tmdbQuery}
            />
            
            <TMDBSelectionGrid
              results={tmdbResults}
              isLoading={tmdbLoading}
              onSelect={selectTMDBResult}
              onRetry={retryTMDBSearch}
            />
          </div>
        );

      case 'service_search':
        return (
          <ServiceSearchStep
            selectedContent={searchState.selectedTMDBResult!}
            services={services}
            onSearch={searchServices}
            onBack={backToTMDBSelection}
            isLoading={serviceLoading}
          />
        );

      case 'completed':
        // Convert service results to enhanced results for display
        const enhancedResults: EnhancedSearchResult[] = serviceResults.map(result => ({
          unshackleResult: result,
          tmdbData: searchState.selectedTMDBResult!,
          displayTitle: result.title,
          displayYear: searchState.selectedTMDBResult?.release_date || searchState.selectedTMDBResult?.first_air_date 
            ? new Date(searchState.selectedTMDBResult.release_date || searchState.selectedTMDBResult.first_air_date!).getFullYear().toString()
            : '',
          posterURL: searchState.selectedTMDBResult?.poster_path 
            ? `https://image.tmdb.org/t/p/w500${searchState.selectedTMDBResult.poster_path}`
            : undefined,
          description: searchState.selectedTMDBResult?.overview,
          rating: searchState.selectedTMDBResult?.vote_average,
          genres: [], // Could map from TMDB genre_ids if needed
        }));

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">
                Search Results for "{searchState.selectedTMDBResult?.title || searchState.selectedTMDBResult?.name}"
              </h2>
              <button
                onClick={resetSearch}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Start New Search
              </button>
            </div>

            {enhancedResults.length > 0 ? (
              <ContentGrid
                results={enhancedResults}
                viewMode="grid"
                onDownload={handleDownload}
              />
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center space-y-2">
                    <p className="text-lg font-medium">No Results Found</p>
                    <p className="text-muted-foreground">
                      "{searchState.selectedTMDBResult?.title || searchState.selectedTMDBResult?.name}" 
                      was not found on the selected streaming services.
                    </p>
                    <button
                      onClick={resetSearch}
                      className="text-sm text-primary hover:underline"
                    >
                      Try a different search
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {renderCurrentStep()}

      {tmdbError && searchState.step === 'tmdb_selection' && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-red-600">Search Error</p>
              <p className="text-muted-foreground">
                Unable to search TMDB. Please try again.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedResult && (
        <DownloadOptionsModal
          isOpen={showDownloadModal}
          onClose={() => {
            setShowDownloadModal(false);
            setSelectedResult(null);
          }}
          onConfirm={handleDownloadSubmit}
          result={selectedResult}
          isLoading={false}
        />
      )}
    </div>
  );
}