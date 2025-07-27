import { useState, useCallback } from 'react';
import { useTMDBSearch, useSearch } from '@/lib/api/queries';
import type { TMDBSearchResult, SearchResult } from '@/lib/types';

interface TwoStepSearchState {
  step: 'initial' | 'tmdb_selection' | 'service_search' | 'completed';
  tmdbQuery: string;
  selectedTMDBResult: TMDBSearchResult | null;
  serviceSearchResults: SearchResult[];
}

export function useTwoStepSearch() {
  const [searchState, setSearchState] = useState<TwoStepSearchState>({
    step: 'initial',
    tmdbQuery: '',
    selectedTMDBResult: null,
    serviceSearchResults: [],
  });

  // TMDB search for content selection
  const { 
    data: tmdbResults = [], 
    isLoading: tmdbLoading, 
    error: tmdbError,
    refetch: refetchTMDB 
  } = useTMDBSearch(searchState.tmdbQuery, 1);

  // State for managing service searches
  const [currentServiceSearch, setCurrentServiceSearch] = useState<{
    service: string;
    query: string;
    type?: 'movie' | 'tv';
  } | null>(null);

  const { 
    data: serviceResults = [], 
    isLoading: serviceLoading, 
    error: serviceError,
  } = useSearch(currentServiceSearch || { service: '', query: '' });

  // Start the search process with TMDB
  const startSearch = useCallback((query: string) => {
    setSearchState({
      step: 'tmdb_selection',
      tmdbQuery: query.trim(),
      selectedTMDBResult: null,
      serviceSearchResults: [],
    });
  }, []);

  // Select a TMDB result and move to service search
  const selectTMDBResult = useCallback((result: TMDBSearchResult) => {
    setSearchState(prev => ({
      ...prev,
      step: 'service_search',
      selectedTMDBResult: result,
    }));
  }, []);

  // Perform service search with selected services
  const searchServices = useCallback((selectedServices: string[]) => {
    if (!searchState.selectedTMDBResult) return;

    // For now, we'll search the first selected service
    // In the future, you could search multiple services concurrently
    const primaryService = selectedServices[0];
    if (primaryService) {
      const searchQuery = getSearchQueryFromTMDB(searchState.selectedTMDBResult);
      
      setCurrentServiceSearch({
        service: primaryService,
        query: searchQuery,
        type: searchState.selectedTMDBResult.media_type === 'movie' ? 'movie' : 'tv',
      });
      
      setSearchState(prev => ({
        ...prev,
        step: 'completed',
      }));
    }
  }, [searchState.selectedTMDBResult]);

  // Reset search to start over
  const resetSearch = useCallback(() => {
    setSearchState({
      step: 'initial',
      tmdbQuery: '',
      selectedTMDBResult: null,
      serviceSearchResults: [],
    });
    setCurrentServiceSearch(null);
  }, []);

  // Go back to TMDB selection
  const backToTMDBSelection = useCallback(() => {
    setSearchState(prev => ({
      ...prev,
      step: 'tmdb_selection',
      selectedTMDBResult: null,
      serviceSearchResults: [],
    }));
    setCurrentServiceSearch(null);
  }, []);

  // Retry TMDB search
  const retryTMDBSearch = useCallback(() => {
    refetchTMDB();
  }, [refetchTMDB]);

  return {
    // State
    searchState,
    
    // TMDB data
    tmdbResults,
    tmdbLoading,
    tmdbError,
    
    // Service data
    serviceResults,
    serviceLoading,
    serviceError,
    
    // Actions
    startSearch,
    selectTMDBResult,
    searchServices,
    resetSearch,
    backToTMDBSelection,
    retryTMDBSearch,
  };
}

// Helper function to create search query from TMDB result
function getSearchQueryFromTMDB(result: TMDBSearchResult): string {
  const title = result.title || result.name || result.original_title || result.original_name || '';
  const year = result.release_date || result.first_air_date;
  const releaseYear = year ? new Date(year).getFullYear() : null;
  
  // Include year for better search accuracy
  return releaseYear ? `${title} ${releaseYear}` : title;
}