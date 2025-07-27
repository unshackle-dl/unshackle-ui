import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
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
  
  clearSearch: () => void;
  clearServiceResults: () => void;
}

export const useSearchStore = create<SearchState>()(
  subscribeWithSelector((set, get) => ({
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
  }))
);