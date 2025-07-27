import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useServices } from '@/lib/api/queries';
import { ServiceCard, ServiceAuthModal, ServiceConfigModal } from '@/components/services';
import type { ServiceInfo } from '@/lib/types';

export function ServicesPage() {
  const { data: services = [], isLoading, error, refetch } = useServices();
  const [selectedServiceAuth, setSelectedServiceAuth] = useState<ServiceInfo | null>(null);
  const [selectedServiceConfig, setSelectedServiceConfig] = useState<ServiceInfo | null>(null);

  const handleRefresh = () => {
    refetch();
  };

  const handleAuthClick = (service: ServiceInfo) => {
    setSelectedServiceAuth(service);
  };

  const handleConfigClick = (service: ServiceInfo) => {
    setSelectedServiceConfig(service);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Service Management</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? 'Loading services...' : `${services.length} service${services.length !== 1 ? 's' : ''} configured`}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center space-x-1"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>
      
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="text-muted-foreground">Loading services...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
              <p className="text-lg font-medium">Failed to load services</p>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred while loading services'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && services.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">No services configured</p>
              <p className="text-muted-foreground">
                No streaming services are available. Check your unshackle.yaml configuration and services directory.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && services.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onAuthClick={handleAuthClick}
              onConfigureClick={handleConfigClick}
            />
          ))}
        </div>
      )}

      {/* Authentication Modal */}
      <ServiceAuthModal
        service={selectedServiceAuth}
        isOpen={!!selectedServiceAuth}
        onClose={() => setSelectedServiceAuth(null)}
      />

      {/* Configuration Modal */}
      <ServiceConfigModal
        service={selectedServiceConfig}
        isOpen={!!selectedServiceConfig}
        onClose={() => setSelectedServiceConfig(null)}
      />

    </div>
  );
}