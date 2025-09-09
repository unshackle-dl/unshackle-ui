'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Settings,
  Server,
  Users,
  Shield,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Clock,
  Network,
  Database,
  FileText,
} from 'lucide-react';
import { useConfig, useProfiles } from '@/lib/hooks/use-config';
import { APIConfig } from '@/lib/services/unshackle-api';
import { Header } from '@/components/header';
import { CredentialForm } from '@/components/credential-form';
import { useToast } from '@/lib/hooks/use-toast';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const { toast } = useToast();

  const {
    config,
    isLoading: configLoading,
    updateConfig,
  } = useConfig({
    onSuccess: message => {
      toast({
        title: 'Success',
        description: message,
        variant: 'success',
      });
    },
    onError: error => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const {
    profiles,
    activeProfile,
    isLoading: profilesLoading,
  } = useProfiles({
    onSuccess: message => {
      toast({
        title: 'Success',
        description: message,
        variant: 'success',
      });
    },
    onError: error => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [formData, setFormData] = useState<Partial<APIConfig>>({});

  // Update form data when config loads
  useEffect(() => {
    if (config?.api) {
      setFormData(config.api);
    }
  }, [config?.api]);

  const handleSaveConfig = async () => {
    try {
      await updateConfig({ api: formData });
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const formatBytes = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8" />
              Settings
            </h1>
            <p className="text-muted-foreground mt-2">
              Configure your Unshackle API settings and manage service credentials
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general" className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="downloads" className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Downloads
              </TabsTrigger>
              <TabsTrigger value="profiles" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Profiles
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Advanced
              </TabsTrigger>
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    API Server Configuration
                  </CardTitle>
                  <CardDescription>Basic server settings for the Unshackle API</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="host">Host</Label>
                      <Input
                        id="host"
                        value={formData.host || ''}
                        onChange={e => setFormData(prev => ({ ...prev, host: e.target.value }))}
                        placeholder="0.0.0.0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="port">Port</Label>
                      <Input
                        id="port"
                        type="number"
                        value={formData.port || ''}
                        onChange={e =>
                          setFormData(prev => ({ ...prev, port: parseInt(e.target.value) }))
                        }
                        placeholder="8786"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workers">Worker Processes</Label>
                    <Input
                      id="workers"
                      type="number"
                      min="1"
                      max="16"
                      value={formData.workers || ''}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, workers: parseInt(e.target.value) }))
                      }
                      placeholder="4"
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of worker processes for handling requests
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5" />
                    Services Status
                  </CardTitle>
                  <CardDescription>Available and configured streaming services</CardDescription>
                </CardHeader>
                <CardContent>
                  {config?.services ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">
                          Available Services ({config.services.available.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {config.services.available.map(service => (
                            <Badge
                              key={service}
                              variant={
                                config.services.configured.includes(service)
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {service}
                              {config.services.configured.includes(service) && (
                                <CheckCircle2 className="h-3 w-3 ml-1" />
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium mb-2">
                          Configured Services ({config.services.configured.length})
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Services with valid credentials that can be used for downloads
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-muted-foreground">Loading services...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Download Settings */}
            <TabsContent value="downloads" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5" />
                    Download Configuration
                  </CardTitle>
                  <CardDescription>
                    Settings for download behavior and file organization
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="download_path">Download Directory</Label>
                    <Input
                      id="download_path"
                      value={formData.download_path || ''}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, download_path: e.target.value }))
                      }
                      placeholder="/downloads"
                    />
                    <p className="text-xs text-muted-foreground">
                      Directory where downloaded files will be saved
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="max_concurrent">Maximum Concurrent Downloads</Label>
                      <Input
                        id="max_concurrent"
                        type="number"
                        min="1"
                        max="10"
                        value={formData.max_concurrent_downloads || ''}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            max_concurrent_downloads: parseInt(e.target.value),
                          }))
                        }
                        placeholder="2"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="queue_size">Queue Size Limit</Label>
                      <Input
                        id="queue_size"
                        type="number"
                        min="1"
                        max="1000"
                        value={formData.download_queue_size || ''}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            download_queue_size: parseInt(e.target.value),
                          }))
                        }
                        placeholder="50"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Cache Settings
                  </CardTitle>
                  <CardDescription>
                    Configure caching behavior for improved performance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="track_ttl">Track List Cache TTL</Label>
                      <Input
                        id="track_ttl"
                        type="number"
                        min="60"
                        value={formData.cache?.track_list_ttl || ''}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            cache: {
                              ...prev.cache!,
                              track_list_ttl: parseInt(e.target.value),
                            },
                          }))
                        }
                        placeholder="3600"
                      />
                      <p className="text-xs text-muted-foreground">
                        {formData.cache?.track_list_ttl
                          ? formatDuration(formData.cache.track_list_ttl)
                          : 'Seconds'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="service_ttl">Service Check TTL</Label>
                      <Input
                        id="service_ttl"
                        type="number"
                        min="60"
                        value={formData.cache?.service_check_ttl || ''}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            cache: {
                              ...prev.cache!,
                              service_check_ttl: parseInt(e.target.value),
                            },
                          }))
                        }
                        placeholder="300"
                      />
                      <p className="text-xs text-muted-foreground">
                        {formData.cache?.service_check_ttl
                          ? formatDuration(formData.cache.service_check_ttl)
                          : 'Seconds'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api_ttl">API Response TTL</Label>
                      <Input
                        id="api_ttl"
                        type="number"
                        min="10"
                        value={formData.cache?.api_response_ttl || ''}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            cache: {
                              ...prev.cache!,
                              api_response_ttl: parseInt(e.target.value),
                            },
                          }))
                        }
                        placeholder="60"
                      />
                      <p className="text-xs text-muted-foreground">
                        {formData.cache?.api_response_ttl
                          ? formatDuration(formData.cache.api_response_ttl)
                          : 'Seconds'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cache_db">Cache Database Path</Label>
                    <Input
                      id="cache_db"
                      value={formData.cache?.database_path || ''}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          cache: {
                            ...prev.cache!,
                            database_path: e.target.value,
                          },
                        }))
                      }
                      placeholder="./data/api_cache.db"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Profiles Tab */}
            <TabsContent value="profiles" className="space-y-6">
              <ProfileManagement />
            </TabsContent>

            {/* Advanced Settings */}
            <TabsContent value="advanced" className="space-y-6">
              <AdvancedSettings formData={formData} setFormData={setFormData} />
            </TabsContent>
          </Tabs>

          {/* Save Button */}
          <div className="mt-8 flex justify-end">
            <Button onClick={handleSaveConfig} disabled={configLoading} className="min-w-32">
              {configLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component for profile management
function ProfileManagement() {
  const { profiles, activeProfile, isLoading, updateCredentials, removeCredentials } = useProfiles({
    onSuccess: message => {
      console.log('Profile operation successful:', message);
    },
    onError: error => {
      console.error('Profile operation failed:', error);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading profiles...</span>
        </CardContent>
      </Card>
    );
  }

  const handleUpdateCredentials = async (service: string, credentials: any) => {
    if (!activeProfile) return;
    await updateCredentials(activeProfile.name, credentials);
  };

  const handleRemoveCredentials = async (service: string) => {
    if (!activeProfile) return;
    await removeCredentials(activeProfile.name, service);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Profile Management
        </CardTitle>
        <CardDescription>Manage service credentials and download profiles</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {profiles.map(profile => (
            <div key={profile.name} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    {profile.name}
                    {profile.is_active && <Badge variant="default">Active</Badge>}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {Object.keys(profile.services).length} services configured
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium">Service Credentials</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {Object.entries(profile.services).map(([service, credentials]) => (
                    <CredentialForm
                      key={service}
                      service={service}
                      profileName={profile.name}
                      credentials={credentials}
                      onUpdate={handleUpdateCredentials}
                      onRemove={handleRemoveCredentials}
                      isLoading={isLoading}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Component for advanced settings
function AdvancedSettings({
  formData,
  setFormData,
}: {
  formData: Partial<APIConfig>;
  setFormData: (data: Partial<APIConfig>) => void;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            WebSocket Configuration
          </CardTitle>
          <CardDescription>Settings for real-time progress updates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ping_interval">Ping Interval (seconds)</Label>
              <Input
                id="ping_interval"
                type="number"
                min="10"
                value={formData.websocket?.ping_interval || ''}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    websocket: {
                      ...prev.websocket!,
                      ping_interval: parseInt(e.target.value),
                    },
                  }))
                }
                placeholder="30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_connections">Max Connections</Label>
              <Input
                id="max_connections"
                type="number"
                min="1"
                value={formData.websocket?.max_connections || ''}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    websocket: {
                      ...prev.websocket!,
                      max_connections: parseInt(e.target.value),
                    },
                  }))
                }
                placeholder="100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reconnect_attempts">Reconnect Attempts</Label>
              <Input
                id="reconnect_attempts"
                type="number"
                min="0"
                value={formData.websocket?.reconnect_attempts || ''}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    websocket: {
                      ...prev.websocket!,
                      reconnect_attempts: parseInt(e.target.value),
                    },
                  }))
                }
                placeholder="5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Logging Configuration
          </CardTitle>
          <CardDescription>Configure logging behavior and file management</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="log_level">Log Level</Label>
              <select
                id="log_level"
                className="w-full px-3 py-2 border rounded-md"
                value={formData.logging?.level || ''}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    logging: {
                      ...prev.logging!,
                      level: e.target.value,
                    },
                  }))
                }
              >
                <option value="DEBUG">DEBUG</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backup_count">Backup Files</Label>
              <Input
                id="backup_count"
                type="number"
                min="0"
                max="20"
                value={formData.logging?.backup_count || ''}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    logging: {
                      ...prev.logging!,
                      backup_count: parseInt(e.target.value),
                    },
                  }))
                }
                placeholder="5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="log_file">Log File Path</Label>
            <Input
              id="log_file"
              value={formData.logging?.file || ''}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  logging: {
                    ...prev.logging!,
                    file: e.target.value,
                  },
                }))
              }
              placeholder="./logs/api.log"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_size">Max File Size</Label>
            <Input
              id="max_size"
              type="number"
              min="1048576"
              value={formData.logging?.max_size || ''}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  logging: {
                    ...prev.logging!,
                    max_size: parseInt(e.target.value),
                  },
                }))
              }
              placeholder="10485760"
            />
            <p className="text-xs text-muted-foreground">
              {formData.logging?.max_size &&
                `Maximum size: ${formatBytes(formData.logging.max_size)}`}
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}
