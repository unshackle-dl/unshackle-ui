import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useServices } from '@/lib/api/queries';

export function ServicesPage() {
  const { data: services = [], isLoading, error } = useServices();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Available</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Service Configuration</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? 'Loading services...' : `${services.length} service${services.length !== 1 ? 's' : ''} configured`}
          </p>
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
            <Card key={service.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  {getStatusIcon(service.status)}
                </div>
                <div className="flex items-center space-x-2">
                  <CardDescription className="text-sm font-mono">
                    {service.id}
                  </CardDescription>
                  {getStatusBadge(service.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {service.description && (
                    <p className="text-sm text-muted-foreground">
                      {service.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <span>Authentication:</span>
                    <Badge variant={service.requires_auth ? "outline" : "secondary"} className="text-xs">
                      {service.requires_auth ? "Required" : "None"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}