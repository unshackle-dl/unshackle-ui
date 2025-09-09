'use client';

import { useState, useCallback } from 'react';
import { UnifiedSearchResponse } from '@/lib/types';
import { SearchInput } from '@/components/search-input';
import { ResultsTable } from '@/components/results-table';
import { PopularContent } from '@/components/popular-content';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Header } from '@/components/header';

export default function Home() {
  const [searchResults, setSearchResults] = useState<UnifiedSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: query,
      });

      const response = await fetch(`/api/search?${params}`);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data: UnifiedSearchResponse = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while searching');
      setSearchResults(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">

        {/* Search Input */}
        <div className="max-w-2xl mx-auto mb-8">
          <SearchInput
            onSearch={handleSearch}
            isLoading={isLoading}
            placeholder="Search for movies and TV shows..."
          />
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Search Results */}
        {searchResults || isLoading ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Search className="h-5 w-5" />
                  <span>Search Results</span>
                </CardTitle>
              </div>

              {searchResults && searchResults.totalResults > 0 && (
                <p className="text-sm text-muted-foreground">
                  Found {searchResults.totalResults} result
                  {searchResults.totalResults !== 1 ? 's' : ''}
                </p>
              )}
            </CardHeader>

            <CardContent>
              <ResultsTable results={searchResults?.results || []} isLoading={isLoading} />
            </CardContent>
          </Card>
        ) : (
          <PopularContent />
        )}

        {/* Footer */}
        <footer className="mt-16 text-center text-xs text-muted-foreground">
          <p>Powered by JustWatch API</p>
        </footer>
      </div>
    </div>
  );
}
