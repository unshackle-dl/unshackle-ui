import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Settings, Save } from 'lucide-react';
import type { ServiceInfo, ServiceConfig } from '@/lib/types';
import { useServiceConfig, useUpdateServiceConfig } from '@/lib/api/queries';

interface ServiceConfigModalProps {
  service: ServiceInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ServiceConfigModal({ service, isOpen, onClose }: ServiceConfigModalProps) {
  const [config, setConfig] = useState<Partial<ServiceConfig>>({
    enabled: true,
    auto_retry: true,
    max_concurrent_downloads: 2,
    timeout: 30000,
    custom_settings: {},
  });

  const { data: currentConfig, isLoading: isLoadingConfig } = useServiceConfig(service?.id || '');
  const updateConfigMutation = useUpdateServiceConfig();

  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig);
    } else if (service?.config) {
      setConfig(service.config);
    }
  }, [currentConfig, service?.config]);

  const handleSave = async () => {
    if (!service) return;
    
    try {
      await updateConfigMutation.mutateAsync({
        service_id: service.id,
        config,
      });
      onClose();
    } catch (error) {
      // Error handled by the mutation's onError
    }
  };

  const handleClose = () => {
    // Reset to current config when closing
    if (currentConfig) {
      setConfig(currentConfig);
    } else if (service?.config) {
      setConfig(service.config);
    }
    onClose();
  };

  if (!service) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <DialogTitle>Service Configuration</DialogTitle>
          </div>
          <DialogDescription>
            Configure settings for {service.name} ({service.id})
          </DialogDescription>
        </DialogHeader>

        {isLoadingConfig ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Basic Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Basic Settings</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enabled">Enable Service</Label>
                  <div className="text-xs text-muted-foreground">
                    Allow this service to be used for searches and downloads
                  </div>
                </div>
                <Switch
                  id="enabled"
                  checked={config.enabled}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto_retry">Auto Retry</Label>
                  <div className="text-xs text-muted-foreground">
                    Automatically retry failed requests
                  </div>
                </div>
                <Switch
                  id="auto_retry"
                  checked={config.auto_retry}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, auto_retry: checked }))}
                />
              </div>
            </div>

            {/* Performance Settings */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Performance Settings</h4>
              
              <div className="space-y-2">
                <Label htmlFor="max_concurrent">Max Concurrent Downloads</Label>
                <Input
                  id="max_concurrent"
                  type="number"
                  min="1"
                  max="10"
                  value={config.max_concurrent_downloads}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    max_concurrent_downloads: parseInt(e.target.value) || 1 
                  }))}
                />
                <div className="text-xs text-muted-foreground">
                  Number of simultaneous downloads from this service
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeout">Request Timeout (ms)</Label>
                <Input
                  id="timeout"
                  type="number"
                  min="5000"
                  max="120000"
                  step="1000"
                  value={config.timeout}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    timeout: parseInt(e.target.value) || 30000 
                  }))}
                />
                <div className="text-xs text-muted-foreground">
                  Maximum time to wait for service responses
                </div>
              </div>
            </div>

            {/* Service-specific Settings */}
            {service.id === 'NF' && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Netflix Settings</h4>
                
                <div className="space-y-2">
                  <Label htmlFor="netflix_profile">Profile Name</Label>
                  <Input
                    id="netflix_profile"
                    type="text"
                    placeholder="Main Profile"
                    value={config.custom_settings?.profile_name || ''}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      custom_settings: { 
                        ...prev.custom_settings, 
                        profile_name: e.target.value 
                      } 
                    }))}
                  />
                </div>
              </div>
            )}

            {service.id === 'DSNP' && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Disney+ Settings</h4>
                
                <div className="space-y-2">
                  <Label htmlFor="disney_region">Region</Label>
                  <Input
                    id="disney_region"
                    type="text"
                    placeholder="US"
                    value={config.custom_settings?.region || ''}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      custom_settings: { 
                        ...prev.custom_settings, 
                        region: e.target.value 
                      } 
                    }))}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateConfigMutation.isPending || isLoadingConfig}
            className="flex items-center space-x-1"
          >
            {updateConfigMutation.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Save Configuration</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}