import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { type ServiceInfo } from '@/lib/types';
import { ServiceSelector } from './service-selector';

interface SearchHeroProps {
  onSearch: (query: string) => void;
  onServiceChange: (services: string[]) => void;
  services: ServiceInfo[];
  selectedServices: string[];
  servicesLoading?: boolean;
  className?: string;
}

export function SearchHero({ 
  onSearch, 
  onServiceChange, 
  services,
  selectedServices,
  servicesLoading = false,
  className 
}: SearchHeroProps) {
  const [query, setQuery] = useState('');
  
  const handleSearch = useCallback(() => {
    if (query.trim()) {
      onSearch(query.trim());
    }
  }, [query, onSearch]);
  
  const handleServiceToggle = useCallback((serviceId: string) => {
    const updated = selectedServices.includes(serviceId)
      ? selectedServices.filter(id => id !== serviceId)
      : [...selectedServices, serviceId];
    onServiceChange(updated);
  }, [selectedServices, onServiceChange]);
  
  return (
    <div className={cn("space-y-6", className)}>
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Content Discovery & Download Manager
        </h1>
        <p className="text-muted-foreground">
          Search across multiple streaming services and download your content
        </p>
      </div>
      
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex space-x-2">
          <Input
            placeholder="Search for movies, shows, music..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={!query.trim()}>
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>
        
        <ServiceSelector
          services={services}
          selected={selectedServices}
          onToggle={handleServiceToggle}
          loading={servicesLoading}
        />
      </div>
    </div>
  );
}