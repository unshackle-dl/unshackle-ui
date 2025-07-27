import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Shield, LogOut, AlertCircle } from 'lucide-react';
import type { ServiceInfo } from '@/lib/types';
import { useAuthenticateService, useLogoutService } from '@/lib/api/queries';

interface ServiceAuthModalProps {
  service: ServiceInfo | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ServiceAuthModal({ service, isOpen, onClose }: ServiceAuthModalProps) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  
  const authenticateServiceMutation = useAuthenticateService();
  const logoutServiceMutation = useLogoutService();

  const isAuthenticated = service?.auth_status === 'authenticated';
  const isExpired = service?.auth_status === 'expired';

  const handleInputChange = (field: string, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
  };

  const handleAuthenticate = async () => {
    if (!service) return;
    
    try {
      await authenticateServiceMutation.mutateAsync({
        service_id: service.id,
        credentials,
      });
      setCredentials({});
      onClose();
    } catch (error) {
      // Error handled by the mutation's onError
    }
  };

  const handleLogout = async () => {
    if (!service) return;
    
    try {
      await logoutServiceMutation.mutateAsync(service.id);
      onClose();
    } catch (error) {
      // Error handled by the mutation's onError
    }
  };

  const handleClose = () => {
    setCredentials({});
    onClose();
  };

  if (!service) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <DialogTitle>
              {isAuthenticated ? 'Authentication Status' : 'Service Authentication'}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isAuthenticated 
              ? `You are currently authenticated with ${service.name}`
              : `Authenticate with ${service.name} to access its content`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isAuthenticated ? (
            <div className="flex items-center space-x-2 p-4 bg-green-50 rounded-lg">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-800">
                Successfully authenticated with {service.name}
              </span>
            </div>
          ) : isExpired ? (
            <div className="flex items-center space-x-2 p-4 bg-yellow-50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                Your authentication has expired. Please re-authenticate.
              </span>
            </div>
          ) : null}

          {!isAuthenticated && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="username">Username/Email</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username or email"
                  value={credentials.username || ''}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={credentials.password || ''}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                />
              </div>

              {/* Some services might need additional fields */}
              {service.id === 'NF' && (
                <div className="space-y-2">
                  <Label htmlFor="esn">ESN (Optional)</Label>
                  <Input
                    id="esn"
                    type="text"
                    placeholder="Netflix ESN"
                    value={credentials.esn || ''}
                    onChange={(e) => handleInputChange('esn', e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          
          <div className="flex space-x-2">
            {isAuthenticated && (
              <Button
                variant="destructive"
                onClick={handleLogout}
                disabled={logoutServiceMutation.isPending}
                className="flex items-center space-x-1"
              >
                {logoutServiceMutation.isPending ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                <span>Logout</span>
              </Button>
            )}
            
            {!isAuthenticated && (
              <Button
                onClick={handleAuthenticate}
                disabled={
                  authenticateServiceMutation.isPending ||
                  !credentials.username ||
                  !credentials.password
                }
                className="flex items-center space-x-1"
              >
                {authenticateServiceMutation.isPending ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                <span>Authenticate</span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}