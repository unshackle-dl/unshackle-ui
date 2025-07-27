import { useEffect, useState } from 'react';
import { useEnhancedSearch } from './use-enhanced-search';
import type { EnhancedSearchResult } from '@/lib/types';

interface UseDebouncedSearchParams {
  query: string;
  services: string[];
  contentTypes?: Array<'movie' | 'tv' | 'music'>;
  debounceMs?: number;
  enabled?: boolean;
}

interface UseDebouncedSearchResult {
  results: EnhancedSearchResult[];
  isLoading: boolean;
  error: string | null;
  debouncedQuery: string;
  isDebouncing: boolean;
}

export function useDebouncedSearch({
  query,
  services,
  contentTypes = ['movie', 'tv'],
  debounceMs = 500,
  enabled = true,
}: UseDebouncedSearchParams): UseDebouncedSearchResult {
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Debounce the search query
  useEffect(() => {
    if (!enabled || !query.trim()) {
      setDebouncedQuery('');
      setIsDebouncing(false);
      return;
    }

    setIsDebouncing(true);
    
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setIsDebouncing(false);
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query, debounceMs, enabled]);

  // Perform the actual search with debounced query
  const searchResult = useEnhancedSearch({
    query: debouncedQuery,
    services,
    contentTypes,
    enabled: enabled && debouncedQuery.length > 0,
  });

  return {
    ...searchResult,
    debouncedQuery,
    isDebouncing,
    isLoading: searchResult.isLoading || isDebouncing,
  };
}