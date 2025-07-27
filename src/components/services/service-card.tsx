import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { 
  CheckCircle, 
  Settings, 
  TestTube, 
  LogIn, 
  LogOut,
  Shield,
  ShieldCheck,
  ShieldX
} from 'lucide-react';
import { useState } from 'react';
import type { ServiceInfo } from '@/lib/types';
import { useTestService, useToggleService } from '@/lib/api/queries';

interface ServiceCardProps {
  service: ServiceInfo;
  onConfigureClick: (service: ServiceInfo) => void;
  onAuthClick: (service: ServiceInfo) => void;
}

export function ServiceCard({ service, onConfigureClick, onAuthClick }: ServiceCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  
  const testServiceMutation = useTestService();
  const toggleServiceMutation = useToggleService();

  const getStatusIcon = () => {
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusBadge = () => {
    return <Badge variant="secondary" className="bg-green-100 text-green-800">Available</Badge>;
  };

  const getAuthIcon = (authStatus?: string) => {
    switch (authStatus) {
      case 'authenticated':
        return <ShieldCheck className="h-4 w-4 text-green-500" />;
      case 'expired':
        return <ShieldX className="h-4 w-4 text-yellow-500" />;
      case 'unauthenticated':
        return <Shield className="h-4 w-4 text-gray-500" />;
      default:
        return <Shield className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAuthBadge = (authStatus?: string) => {
    if (!service.requires_auth) {
      return <Badge variant="secondary" className="text-xs">No Auth Required</Badge>;
    }
    
    switch (authStatus) {
      case 'authenticated':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">Authenticated</Badge>;
      case 'expired':
        return <Badge variant="outline" className="text-yellow-700 text-xs">Token Expired</Badge>;
      case 'unauthenticated':
        return <Badge variant="outline" className="text-xs">Not Authenticated</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Unknown</Badge>;
    }
  };

  const handleTestService = async () => {
    testServiceMutation.mutate(service.id);
  };

  const handleToggleService = async (enabled: boolean) => {
    setIsToggling(true);
    try {
      await toggleServiceMutation.mutateAsync({ serviceId: service.id, enabled });
    } finally {
      setIsToggling(false);
    }
  };

  const isServiceEnabled = service.config?.enabled ?? true;

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-lg">{service.name}</CardTitle>
            {getStatusIcon()}
          </div>
          <div className="flex items-center space-x-2">
            {isToggling ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Switch
                checked={isServiceEnabled}
                onCheckedChange={handleToggleService}
                disabled={toggleServiceMutation.isPending}
              />
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <CardDescription className="text-sm font-mono">
            {service.id}
          </CardDescription>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {service.description && (
          <p className="text-sm text-muted-foreground">
            {service.description}
          </p>
        )}
        
        {/* Authentication Status */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1">
            {getAuthIcon(service.auth_status)}
            <span>Authentication:</span>
          </div>
          {getAuthBadge(service.auth_status)}
        </div>
        
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestService}
            disabled={testServiceMutation.isPending}
            className="flex items-center space-x-1"
          >
            {testServiceMutation.isPending ? (
              <Spinner className="h-3 w-3" />
            ) : (
              <TestTube className="h-3 w-3" />
            )}
            <span>Test</span>
          </Button>
          
          {service.requires_auth && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAuthClick(service)}
              className="flex items-center space-x-1"
            >
              {service.auth_status === 'authenticated' ? (
                <>
                  <LogOut className="h-3 w-3" />
                  <span>Logout</span>
                </>
              ) : (
                <>
                  <LogIn className="h-3 w-3" />
                  <span>Login</span>
                </>
              )}
            </Button>
          )}
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => onConfigureClick(service)}
            className="flex items-center space-x-1"
          >
            <Settings className="h-3 w-3" />
            <span>Configure</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}