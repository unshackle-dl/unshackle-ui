import { Wifi, WifiOff, Loader2, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useWebSocketContext } from '@/contexts/websocket-context';
import { useDownloadWebSocket } from '@/hooks/use-download-websocket';

interface ConnectionStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
  showPollingMode?: boolean; // New: show polling fallback status
}

export function ConnectionStatusIndicator({ className, showDetails = false, showPollingMode = false }: ConnectionStatusIndicatorProps) {
  const { isConnected, connectionState, reconnectAttempts, connectionMetadata, lastError } = useWebSocketContext();
  
  // Get polling status information when polling mode display is enabled
  const pollingInfo = showPollingMode ? useDownloadWebSocket() : null;
  
  const getStatusConfig = () => {
    // Check if polling is active to modify the display
    const isPollingActive = pollingInfo?.isPolling;
    const pollingReason = pollingInfo?.pollingReason;
    
    switch (connectionState) {
      case 'connected':
        return {
          icon: Wifi,
          label: 'WebSocket Connected',
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
          icon: isPollingActive ? RefreshCw : AlertTriangle,
          label: isPollingActive ? 'Polling Mode' : 'Auth Failed',
          variant: isPollingActive ? 'secondary' : 'destructive' as const,
          className: isPollingActive ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white',
          animate: isPollingActive,
        };
      case 'job_not_found':
        return {
          icon: isPollingActive ? RefreshCw : AlertTriangle,
          label: isPollingActive ? 'Polling Mode' : 'Job Not Found',
          variant: isPollingActive ? 'secondary' : 'destructive' as const,
          className: isPollingActive ? 'bg-blue-600 text-white' : 'bg-purple-500 text-white',
          animate: isPollingActive,
        };
      case 'error':
        return {
          icon: isPollingActive ? RefreshCw : AlertTriangle,
          label: isPollingActive ? 'Polling Mode' : 'Connection Error',
          variant: isPollingActive ? 'secondary' : 'destructive' as const,
          className: isPollingActive ? 'bg-blue-600 text-white' : 'bg-red-500 text-white',
          animate: isPollingActive,
        };
      case 'disconnected':
      default:
        return {
          icon: isPollingActive ? RefreshCw : WifiOff,
          label: isPollingActive ? 'Polling Mode' : 'Disconnected',
          variant: isPollingActive ? 'secondary' : 'destructive' as const,
          className: isPollingActive ? 'bg-blue-600 text-white' : 'bg-gray-500 text-white',
          animate: isPollingActive,
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
          {/* Polling status information (when polling mode is enabled) */}
          {showPollingMode && pollingInfo && (
            <>
              {pollingInfo.isPolling && (
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3 text-blue-600" />
                  <span className="text-xs text-blue-600">
                    Polling every {Math.round(pollingInfo.pollingInterval / 1000)}s
                  </span>
                </div>
              )}
              
              {pollingInfo.pollingReason !== 'not_needed' && (
                <span className="text-xs text-muted-foreground">
                  Reason: {pollingInfo.pollingReason.replace('_', ' ')}
                </span>
              )}
              
              {pollingInfo.isPollingForAuthFailure && (
                <span className="text-xs text-orange-600">
                  WebSocket auth failed - using REST API
                </span>
              )}
              
              {pollingInfo.lastPollingSuccess && (
                <span className="text-xs text-muted-foreground">
                  Last update: {Math.floor((Date.now() - pollingInfo.lastPollingSuccess) / 1000)}s ago
                </span>
              )}
            </>
          )}
          
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
          
          {/* Error-specific messages with polling fallback info */}
          {lastError && connectionState === 'auth_failed' && (
            <span className="text-xs text-orange-600 max-w-48 text-right">
              {pollingInfo?.isPolling ? 'Using REST API fallback' : 'Check API configuration'}
            </span>
          )}
          {lastError && connectionState === 'job_not_found' && (
            <span className="text-xs text-purple-600 max-w-48 text-right">
              {pollingInfo?.isPolling ? 'Using REST API fallback' : 'Job may be completed or removed'}
            </span>
          )}
          {lastError && connectionState === 'error' && (
            <span className="text-xs text-red-600 max-w-48 text-right">
              {pollingInfo?.isPolling ? 'Using REST API fallback' : lastError}
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