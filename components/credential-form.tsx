'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Eye,
  EyeOff,
  Save,
  Trash2,
  Edit,
  AlertCircle,
  CheckCircle2,
  Database,
  Shield,
  Plus
} from 'lucide-react';
import { ServiceCredentials, CredentialUpdateRequest } from '@/lib/services/unshackle-api';

interface CredentialFormProps {
  service: string;
  profileName: string;
  credentials?: ServiceCredentials;
  onUpdate: (service: string, credentials: CredentialUpdateRequest) => Promise<void>;
  onRemove: (service: string) => Promise<void>;
  isLoading?: boolean;
}

export function CredentialForm({
  service,
  profileName,
  credentials,
  onUpdate,
  onRemove,
  isLoading = false
}: CredentialFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<CredentialUpdateRequest>({
    service,
    username: credentials?.username || '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCredentials = credentials?.username || credentials?.password;
  const hasCookies = credentials?.has_cookies;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username.trim()) {
      setError('Username is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onUpdate(service, formData);
      setIsOpen(false);
      setFormData({ service, username: '', password: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onRemove(service);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = () => {
    if (hasCredentials && hasCookies) return 'bg-green-100 text-green-800';
    if (hasCredentials) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusText = () => {
    if (hasCredentials && hasCookies) return 'Configured';
    if (hasCredentials) return 'Partial';
    return 'Not Configured';
  };

  return (
    <Card className="transition-colors hover:bg-muted/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono">
              {service}
            </Badge>
            <Badge className={getStatusColor()}>
              {getStatusText()}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {hasCredentials && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {credentials?.username && (
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    <span>Auth</span>
                  </div>
                )}
                {hasCookies && (
                  <div className="flex items-center gap-1">
                    <Database className="h-3 w-3" />
                    <span>Cookies</span>
                  </div>
                )}
              </div>
            )}
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  {hasCredentials ? (
                    <>
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </DialogTrigger>
              
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {hasCredentials ? 'Edit' : 'Add'} Credentials for {service}
                  </DialogTitle>
                  <DialogDescription>
                    Update the login credentials for {service} service in profile "{profileName}".
                  </DialogDescription>
                </DialogHeader>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username/Email</Label>
                    <Input
                      id="username"
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Enter username or email"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter password"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leave empty to keep existing password
                    </p>
                  </div>

                  {hasCookies && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-blue-800">
                        <Database className="h-4 w-4" />
                        <span className="text-sm font-medium">Cookies Available</span>
                      </div>
                      <p className="text-xs text-blue-700 mt-1">
                        This service has cookie files available for authentication.
                      </p>
                    </div>
                  )}

                  <DialogFooter className="flex gap-2">
                    {hasCredentials && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleRemove}
                        disabled={isSubmitting}
                        className="mr-auto"
                      >
                        {isSubmitting ? (
                          <div className="animate-spin h-4 w-4 mr-1 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-1" />
                        )}
                        Remove
                      </Button>
                    )}
                    
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsOpen(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <div className="animate-spin h-4 w-4 mr-1 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      {hasCredentials ? 'Update' : 'Add'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Credential status details */}
        <div className="mt-3 text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-4">
            <span>Username: {credentials?.username ? '✓ Set' : '✗ Not set'}</span>
            <span>Password: {credentials?.password ? '✓ Set' : '✗ Not set'}</span>
            <span>Cookies: {hasCookies ? '✓ Available' : '✗ Not available'}</span>
          </div>
          
          {credentials?.username && (
            <div className="text-xs">
              <span className="font-medium">Username:</span> {credentials.username}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}