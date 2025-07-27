import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { type ServiceInfo } from '@/lib/types';

interface ServiceSelectorProps {
  services: ServiceInfo[];
  selected: string[];
  onToggle: (serviceId: string) => void;
  loading?: boolean;
  className?: string;
}

export function ServiceSelector({ 
  services, 
  selected, 
  onToggle, 
  loading = false,
  className 
}: ServiceSelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">Select Services</Label>
      <div className="flex flex-wrap gap-2">
        {loading ? (
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading services...</span>
          </div>
        ) : services.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No services available
          </div>
        ) : (
          services.map((service) => (
            <Button
              key={service.id}
              variant={selected.includes(service.id) ? "default" : "outline"}
              size="sm"
              onClick={() => onToggle(service.id)}
              className="relative"
              title={service.description || service.name}
            >
              <span className="mr-2">{service.name}</span>
              {service.status === 'available' ? (
                <div className="h-2 w-2 rounded-full bg-green-500" />
              ) : service.status === 'error' ? (
                <div className="h-2 w-2 rounded-full bg-red-500" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
              )}
            </Button>
          ))
        )}
      </div>
    </div>
  );
}