import { Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useWebSocketContext } from '@/contexts/websocket-context';

interface ConnectionStatusIndicatorProps {
  className?: string;
}

export function ConnectionStatusIndicator({ className }: ConnectionStatusIndicatorProps) {
  const { isConnected } = useWebSocketContext();
  
  const getStatusConfig = () => {
    if (isConnected) {
      return {
        icon: Wifi,
        label: 'Connected',
        variant: 'default' as const,
        className: 'bg-green-500 text-white',
      };
    }
    
    return {
      icon: WifiOff,
      label: 'Disconnected',
      variant: 'destructive' as const,
      className: 'bg-red-500 text-white',
    };
  };
  
  const config = getStatusConfig();
  const Icon = config.icon;
  
  return (
    <Badge 
      variant={config.variant}
      className={cn(
        'flex items-center space-x-1 px-2 py-1',
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="text-xs">{config.label}</span>
    </Badge>
  );
}