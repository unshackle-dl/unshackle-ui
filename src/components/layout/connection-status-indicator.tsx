import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useWebSocketContext } from '@/contexts/websocket-context';

interface ConnectionStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function ConnectionStatusIndicator({ className, showDetails = false }: ConnectionStatusIndicatorProps) {
  const { isConnected, connectionState, reconnectAttempts, connectionMetadata, lastError } = useWebSocketContext();
  
  const getStatusConfig = () => {
    switch (connectionState) {
      case 'connected':
        return {
          icon: Wifi,
          label: 'Connected',
          variant: 'default' as const,
          className: 'bg-green-500 text-white',
        };
      case 'connecting':
        return {
          icon: Loader2,
          label: 'Connecting...',
          variant: 'secondary' as const,
          className: 'bg-blue-500 text-white',
          animate: true,
        };
      case 'reconnecting':
        return {
          icon: Loader2,
          label: `Reconnecting... (${reconnectAttempts})`,
          variant: 'secondary' as const,
          className: 'bg-yellow-500 text-white',
          animate: true,
        };
      case 'auth_failed':
        return {
          icon: AlertTriangle,
          label: 'Auth Failed',
          variant: 'destructive' as const,
          className: 'bg-orange-500 text-white',
        };
      case 'job_not_found':
        return {
          icon: AlertTriangle,
          label: 'Job Not Found',
          variant: 'destructive' as const,
          className: 'bg-purple-500 text-white',
        };
      case 'error':
        return {
          icon: AlertTriangle,
          label: 'Connection Error',
          variant: 'destructive' as const,
          className: 'bg-red-500 text-white',
        };
      case 'disconnected':
      default:
        return {
          icon: WifiOff,
          label: 'Disconnected',
          variant: 'destructive' as const,
          className: 'bg-gray-500 text-white',
        };
    }
  };
  
  const config = getStatusConfig();
  const Icon = config.icon;
  
  const formatLastConnected = () => {
    if (!connectionMetadata.lastConnected) return '';
    const now = new Date();
    const diff = now.getTime() - connectionMetadata.lastConnected.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `Last connected ${hours}h ago`;
    } else if (minutes > 0) {
      return `Last connected ${minutes}m ago`;
    } else {
      return 'Just connected';
    }
  };
  
  const formatConnectionDuration = () => {
    if (!isConnected || !connectionMetadata.lastConnected) return '';
    const duration = connectionMetadata.connectionDuration || (Date.now() - connectionMetadata.lastConnected.getTime());
    const minutes = Math.floor(duration / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `Connected for ${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `Connected for ${minutes}m`;
    } else {
      return 'Just connected';
    }
  };
  
  const getConnectionQualityColor = () => {
    switch (connectionMetadata.connectionQuality) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'poor': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };
  
  return (
    <div className="flex flex-col items-end">
      <Badge 
        variant={config.variant}
        className={cn(
          'flex items-center space-x-1 px-2 py-1',
          config.className,
          className
        )}
      >
        <Icon className={cn(
          "h-3 w-3",
          config.animate && "animate-spin"
        )} />
        <span className="text-xs">{config.label}</span>
      </Badge>
      {showDetails && (
        <div className="flex flex-col items-end space-y-1 mt-1">
          {/* Connection duration when connected */}
          {isConnected && connectionMetadata.lastConnected && (
            <span className="text-xs text-muted-foreground">
              {formatConnectionDuration()}
            </span>
          )}
          
          {/* Last connected time when disconnected */}
          {!isConnected && connectionMetadata.lastConnected && (
            <span className="text-xs text-muted-foreground">
              {formatLastConnected()}
            </span>
          )}
          
          {/* Connection type and job info */}
          {connectionMetadata.connectionType && (
            <span className="text-xs text-muted-foreground">
              {connectionMetadata.connectionType === 'job' 
                ? `Job: ${connectionMetadata.currentJobId || 'Unknown'}`
                : 'Global events'
              }
            </span>
          )}
          
          {/* Connection quality when connected */}
          {isConnected && connectionMetadata.connectionQuality !== 'unknown' && (
            <span className={`text-xs ${getConnectionQualityColor()}`}>
              Quality: {connectionMetadata.connectionQuality}
            </span>
          )}
          
          {/* Heartbeat status when connected */}
          {isConnected && connectionMetadata.isHeartbeatActive && connectionMetadata.lastPong && (
            <span className="text-xs text-muted-foreground">
              Last ping: {Math.floor((Date.now() - connectionMetadata.lastPong.getTime()) / 1000)}s ago
            </span>
          )}
          
          {/* Reconnection info */}
          {reconnectAttempts > 0 && (
            <span className="text-xs text-yellow-600">
              Reconnect attempts: {reconnectAttempts}
            </span>
          )}
          
          {/* Error-specific messages */}
          {lastError && connectionState === 'auth_failed' && (
            <span className="text-xs text-orange-600 max-w-48 text-right">
              Check API configuration
            </span>
          )}
          {lastError && connectionState === 'job_not_found' && (
            <span className="text-xs text-purple-600 max-w-48 text-right">
              Job may be completed or removed
            </span>
          )}
          {lastError && connectionState === 'error' && (
            <span className="text-xs text-red-600 max-w-48 text-right">
              {lastError}
            </span>
          )}
          
          {/* Last error time */}
          {!isConnected && connectionMetadata.lastErrorTime && (
            <span className="text-xs text-muted-foreground">
              Last error: {Math.floor((Date.now() - connectionMetadata.lastErrorTime.getTime()) / 1000)}s ago
            </span>
          )}
        </div>
      )}
    </div>
  );
}