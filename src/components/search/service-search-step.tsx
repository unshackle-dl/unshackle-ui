import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Search, Calendar, Star } from 'lucide-react';
import type { TMDBSearchResult, ServiceInfo } from '@/lib/types';

interface ServiceSearchStepProps {
  selectedContent: TMDBSearchResult;
  services: ServiceInfo[];
  onSearch: (selectedServices: string[]) => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function ServiceSearchStep({ 
  selectedContent, 
  services, 
  onSearch, 
  onBack, 
  isLoading = false 
}: ServiceSearchStepProps) {
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const getTitle = (result: TMDBSearchResult) => {
    return result.title || result.name || result.original_title || result.original_name || 'Unknown Title';
  };

  const getReleaseYear = (result: TMDBSearchResult) => {
    const date = result.release_date || result.first_air_date;
    return date ? new Date(date).getFullYear() : null;
  };

  const getPosterUrl = (posterPath?: string) => {
    if (!posterPath) return null;
    return `https://image.tmdb.org/t/p/w300${posterPath}`;
  };

  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    setSelectedServices(prev => 
      checked 
        ? [...prev, serviceId]
        : prev.filter(id => id !== serviceId)
    );
  };

  const handleSearch = () => {
    if (selectedServices.length > 0) {
      onSearch(selectedServices);
    }
  };

  const title = getTitle(selectedContent);
  const year = getReleaseYear(selectedContent);
  const posterUrl = getPosterUrl(selectedContent.poster_path);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="flex items-center space-x-2"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Choose Different Title</span>
      </Button>

      {/* Selected content display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selected Content</CardTitle>
          <CardDescription>
            Now choose which streaming services to search
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            {posterUrl && (
              <img
                src={posterUrl}
                alt={title}
                className="w-24 h-36 object-cover rounded-md"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="flex-1 space-y-2">
              <h3 className="text-xl font-semibold">{title}</h3>
              
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                {year && (
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>{year}</span>
                  </div>
                )}
                
                {selectedContent.vote_average > 0 && (
                  <div className="flex items-center space-x-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{selectedContent.vote_average.toFixed(1)}</span>
                  </div>
                )}
                
                <Badge variant="outline">
                  {selectedContent.media_type === 'movie' ? 'Movie' : 'TV Show'}
                </Badge>
              </div>
              
              {selectedContent.overview && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {selectedContent.overview}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Streaming Services</CardTitle>
          <CardDescription>
            Choose which services to search for "{title}"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {services
              .filter(service => service.config?.enabled !== false)
              .map((service) => (
                <div
                  key={service.id}
                  className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleServiceToggle(service.id, !selectedServices.includes(service.id))}
                >
                  <Checkbox
                    id={service.id}
                    checked={selectedServices.includes(service.id)}
                    onCheckedChange={(checked) => handleServiceToggle(service.id, checked as boolean)}
                  />
                  <div className="flex-1 min-w-0">
                    <label htmlFor={service.id} className="font-medium cursor-pointer">
                      {service.name}
                    </label>
                    <p className="text-xs text-muted-foreground font-mono">
                      {service.id}
                    </p>
                  </div>
                </div>
              ))}
          </div>

          {services.filter(service => service.config?.enabled !== false).length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No streaming services available</p>
              <p className="text-sm text-muted-foreground">Check your service configuration</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search button */}
      <div className="flex justify-center">
        <Button
          onClick={handleSearch}
          disabled={selectedServices.length === 0 || isLoading}
          size="lg"
          className="flex items-center space-x-2"
        >
          <Search className="h-4 w-4" />
          <span>
            {isLoading ? 'Searching...' : `Search ${selectedServices.length} Service${selectedServices.length !== 1 ? 's' : ''}`}
          </span>
        </Button>
      </div>
    </div>
  );
}