import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { type TMDBSearchResult, type EnhancedSearchResult, type SearchResult } from '@/lib/types';

interface SearchState {
  // TMDB Search
  tmdbQuery: string;
  tmdbResults: TMDBSearchResult[];
  tmdbLoading: boolean;
  tmdbError: string | null;
  selectedTitle: TMDBSearchResult | null;

  // Service Search
  selectedServices: string[];
  serviceSearchResults: Record<string, SearchResult[]>;
  serviceSearchLoading: Record<string, boolean>;
  serviceSearchErrors: Record<string, string | null>;

  // Aggregated Results
  aggregatedResults: EnhancedSearchResult[];
  aggregationLoading: boolean;

  // Search History and Caching
  searchHistory: Array<{
    query: string;
    timestamp: number;
    resultCount: number;
  }>;
  cachedResults: Record<string, {
    results: EnhancedSearchResult[];
    timestamp: number;
    ttl: number;
  }>;

  // Content Type Filters
  selectedContentTypes: Array<'movie' | 'tv' | 'music'>;

  // Advanced Search State
  isAdvancedSearch: boolean;
  searchFilters: {
    year?: { min?: number; max?: number };
    rating?: { min?: number; max?: number };
    genres?: string[];
    language?: string;
  };

  // Actions
  setTmdbQuery: (query: string) => void;
  setTmdbResults: (results: TMDBSearchResult[]) => void;
  setTmdbLoading: (loading: boolean) => void;
  setTmdbError: (error: string | null) => void;
  setSelectedTitle: (title: TMDBSearchResult | null) => void;
  
  setSelectedServices: (services: string[]) => void;
  toggleService: (serviceId: string) => void;
  setServiceResults: (serviceId: string, results: SearchResult[]) => void;
  setServiceLoading: (serviceId: string, loading: boolean) => void;
  setServiceError: (serviceId: string, error: string | null) => void;
  
  setAggregatedResults: (results: EnhancedSearchResult[]) => void;
  setAggregationLoading: (loading: boolean) => void;
  
  // New enhanced actions
  addToSearchHistory: (query: string, resultCount: number) => void;
  clearSearchHistory: () => void;
  getCachedResults: (query: string) => EnhancedSearchResult[] | null;
  setCachedResults: (query: string, results: EnhancedSearchResult[], ttl?: number) => void;
  clearExpiredCache: () => void;
  
  setSelectedContentTypes: (types: Array<'movie' | 'tv' | 'music'>) => void;
  toggleContentType: (type: 'movie' | 'tv' | 'music') => void;
  
  setAdvancedSearch: (isAdvanced: boolean) => void;
  setSearchFilters: (filters: SearchState['searchFilters']) => void;
  updateSearchFilter: <K extends keyof SearchState['searchFilters']>(
    key: K, 
    value: SearchState['searchFilters'][K]
  ) => void;
  
  clearSearch: () => void;
  clearServiceResults: () => void;
  resetFilters: () => void;
}

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_HISTORY_SIZE = 50;

export const useSearchStore = create<SearchState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        tmdbQuery: '',
        tmdbResults: [],
        tmdbLoading: false,
        tmdbError: null,
        selectedTitle: null,

        selectedServices: ['NF', 'DSNP'], // Default to Netflix and Disney+
        serviceSearchResults: {},
        serviceSearchLoading: {},
        serviceSearchErrors: {},

        aggregatedResults: [],
        aggregationLoading: false,

        // New state
        searchHistory: [],
        cachedResults: {},
        selectedContentTypes: ['movie', 'tv'],
        isAdvancedSearch: false,
        searchFilters: {},

    // Actions
    setTmdbQuery: (query) => set({ tmdbQuery: query }),
    setTmdbResults: (results) => set({ tmdbResults: results }),
    setTmdbLoading: (loading) => set({ tmdbLoading: loading }),
    setTmdbError: (error) => set({ tmdbError: error }),
    setSelectedTitle: (title) => set({ selectedTitle: title }),

    setSelectedServices: (services) => set({ selectedServices: services }),
    toggleService: (serviceId) => {
      const { selectedServices } = get();
      const newServices = selectedServices.includes(serviceId)
        ? selectedServices.filter(id => id !== serviceId)
        : [...selectedServices, serviceId];
      set({ selectedServices: newServices });
    },

    setServiceResults: (serviceId, results) => set((state) => ({
      serviceSearchResults: {
        ...state.serviceSearchResults,
        [serviceId]: results,
      },
    })),

    setServiceLoading: (serviceId, loading) => set((state) => ({
      serviceSearchLoading: {
        ...state.serviceSearchLoading,
        [serviceId]: loading,
      },
    })),

    setServiceError: (serviceId, error) => set((state) => ({
      serviceSearchErrors: {
        ...state.serviceSearchErrors,
        [serviceId]: error,
      },
    })),

    setAggregatedResults: (results) => set({ aggregatedResults: results }),
    setAggregationLoading: (loading) => set({ aggregationLoading: loading }),

    clearSearch: () => set({
      tmdbQuery: '',
      tmdbResults: [],
      tmdbError: null,
      selectedTitle: null,
      serviceSearchResults: {},
      serviceSearchErrors: {},
      aggregatedResults: [],
    }),

    clearServiceResults: () => set({
      serviceSearchResults: {},
      serviceSearchErrors: {},
      aggregatedResults: [],
    }),

    // New enhanced actions
    addToSearchHistory: (query, resultCount) => {
      const { searchHistory } = get();
      const trimmedQuery = query.trim().toLowerCase();
      
      // Remove existing entry if it exists
      const filteredHistory = searchHistory.filter(entry => 
        entry.query.toLowerCase() !== trimmedQuery
      );
      
      // Add new entry at the beginning
      const newHistory = [
        { query: trimmedQuery, timestamp: Date.now(), resultCount },
        ...filteredHistory
      ].slice(0, MAX_HISTORY_SIZE);
      
      set({ searchHistory: newHistory });
    },

    clearSearchHistory: () => set({ searchHistory: [] }),

    getCachedResults: (query) => {
      const { cachedResults } = get();
      const cacheKey = query.trim().toLowerCase();
      const cached = cachedResults[cacheKey];
      
      if (!cached) return null;
      
      // Check if cache has expired
      if (Date.now() - cached.timestamp > cached.ttl) {
        // Remove expired cache entry
        const newCache = { ...cachedResults };
        delete newCache[cacheKey];
        set({ cachedResults: newCache });
        return null;
      }
      
      return cached.results;
    },

    setCachedResults: (query, results, ttl = CACHE_TTL) => {
      const { cachedResults } = get();
      const cacheKey = query.trim().toLowerCase();
      
      set({
        cachedResults: {
          ...cachedResults,
          [cacheKey]: {
            results,
            timestamp: Date.now(),
            ttl,
          },
        },
      });
    },

    clearExpiredCache: () => {
      const { cachedResults } = get();
      const now = Date.now();
      const validCache: typeof cachedResults = {};
      
      Object.entries(cachedResults).forEach(([key, cache]) => {
        if (now - cache.timestamp <= cache.ttl) {
          validCache[key] = cache;
        }
      });
      
      set({ cachedResults: validCache });
    },

    setSelectedContentTypes: (types) => set({ selectedContentTypes: types }),

    toggleContentType: (type) => {
      const { selectedContentTypes } = get();
      const newTypes = selectedContentTypes.includes(type)
        ? selectedContentTypes.filter(t => t !== type)
        : [...selectedContentTypes, type];
      set({ selectedContentTypes: newTypes });
    },

    setAdvancedSearch: (isAdvanced) => set({ isAdvancedSearch: isAdvanced }),
    
    setSearchFilters: (filters) => set({ searchFilters: filters }),
    
    updateSearchFilter: (key, value) => {
      const { searchFilters } = get();
      set({
        searchFilters: {
          ...searchFilters,
          [key]: value,
        },
      });
    },

    resetFilters: () => set({
      searchFilters: {},
      selectedContentTypes: ['movie', 'tv'],
      isAdvancedSearch: false,
    }),
      }),
      {
        name: 'unshackle-search-store',
        partialize: (state) => ({
          selectedServices: state.selectedServices,
          searchHistory: state.searchHistory,
          selectedContentTypes: state.selectedContentTypes,
          searchFilters: state.searchFilters,
          isAdvancedSearch: state.isAdvancedSearch,
          // Don't persist results, errors, or loading states
        }),
      }
    )
  )
);