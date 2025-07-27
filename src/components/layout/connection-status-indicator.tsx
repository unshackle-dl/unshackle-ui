import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useWebSocketContext } from '@/contexts/websocket-context';

interface ConnectionStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function ConnectionStatusIndicator({ className, showDetails = false }: ConnectionStatusIndicatorProps) {
  const { isConnected, connectionState, reconnectAttempts, lastConnected } = useWebSocketContext();
  
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
    if (!lastConnected) return '';
    const now = new Date();
    const diff = now.getTime() - lastConnected.getTime();
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
      {showDetails && !isConnected && lastConnected && (
        <span className="text-xs text-muted-foreground mt-1">
          {formatLastConnected()}
        </span>
      )}
    </div>
  );
}