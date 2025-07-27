import { useWebSocketContext } from '@/contexts/websocket-context';
import { ConnectionStatusIndicator } from '@/components/layout/connection-status-indicator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Power, PowerOff, Activity } from 'lucide-react';

interface WebSocketStatusProps {
  showControls?: boolean;
  compact?: boolean;
}

export function WebSocketStatus({ showControls = false, compact = false }: WebSocketStatusProps) {
  const { 
    isConnected, 
    connectionState, 
    lastConnected, 
    reconnectAttempts, 
    connect, 
    disconnect 
  } = useWebSocketContext();

  const formatLastConnected = () => {
    if (!lastConnected) return 'Never';
    const now = new Date();
    const diff = now.getTime() - lastConnected.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected': return 'text-green-600';
      case 'connecting': 
      case 'reconnecting': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      case 'disconnected': 
      default: return 'text-gray-600';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <ConnectionStatusIndicator />
        {reconnectAttempts > 0 && (
          <Badge variant="secondary" className="text-xs">
            Retry {reconnectAttempts}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">WebSocket Connection</CardTitle>
            <CardDescription className="text-xs">
              Real-time updates status
            </CardDescription>
          </div>
          <ConnectionStatusIndicator />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Status:</span>
              <p className={`font-medium capitalize ${getStatusColor()}`}>
                {connectionState}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Connected:</span>
              <p className="font-medium">{formatLastConnected()}</p>
            </div>
          </div>

          {reconnectAttempts > 0 && (
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">
                Reconnection attempt {reconnectAttempts}
              </span>
            </div>
          )}

          {showControls && (
            <>
              <div className="border-t my-2" />
              <div className="flex space-x-2">
                {isConnected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnect}
                    className="flex-1"
                  >
                    <PowerOff className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={connect}
                    className="flex-1"
                  >
                    <Power className="mr-2 h-4 w-4" />
                    Connect
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    disconnect();
                    setTimeout(connect, 1000);
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}