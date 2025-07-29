import { useWebSocketContext } from "@/contexts/websocket-context";
import { useDownloadWebSocket } from "@/hooks/use-download-websocket";
import { ConnectionStatusIndicator } from "@/components/layout/connection-status-indicator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Power,
  PowerOff,
  Activity,
  Clock,
  Wifi,
} from "lucide-react";

interface WebSocketStatusProps {
  showControls?: boolean;
  compact?: boolean;
}

export function WebSocketStatus({
  showControls = false,
  compact = false,
}: WebSocketStatusProps) {
  const {
    isConnected,
    connectionState,
    connectionMetadata,
    reconnectAttempts,
    connect,
    disconnect,
  } = useWebSocketContext();

  // Get polling status for enhanced feedback
  const { isPolling, pollingInterval, isPollingForAuthFailure } =
    useDownloadWebSocket();

  const formatLastConnected = () => {
    if (!connectionMetadata.lastConnected) return "Never";
    const now = new Date();
    const diff = now.getTime() - connectionMetadata.lastConnected.getTime();
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
      return "Just now";
    }
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case "connected":
        return "text-green-600";
      case "connecting":
      case "reconnecting":
        return "text-yellow-600";
      case "auth_failed":
        return "text-orange-600";
      case "job_not_found":
        return "text-purple-600";
      case "error":
        return "text-red-600";
      case "disconnected":
      default:
        return "text-gray-600";
    }
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <ConnectionStatusIndicator showPollingMode />
        {reconnectAttempts > 0 && (
          <Badge variant="secondary" className="text-xs">
            Retry {reconnectAttempts}
          </Badge>
        )}
        {isPolling && (
          <Badge
            variant="outline"
            className="text-xs flex items-center space-x-1"
          >
            <Clock className="h-3 w-3" />
            <span>Polling</span>
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
            <CardTitle className="text-sm font-medium">
              {isConnected
                ? "WebSocket Connection"
                : isPolling
                ? "Polling Mode"
                : "Disconnected"}
            </CardTitle>
            <CardDescription className="text-xs">
              {isConnected
                ? "Real-time updates active"
                : isPolling
                ? "REST API fallback active"
                : "No updates available"}
            </CardDescription>
          </div>
          <ConnectionStatusIndicator showPollingMode />
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
              <span className="text-muted-foreground">Update Mode:</span>
              <p className="font-medium flex items-center space-x-1">
                {isConnected ? (
                  <>
                    <Wifi className="h-3 w-3 text-green-600" />
                    <span className="text-green-600">WebSocket</span>
                  </>
                ) : isPolling ? (
                  <>
                    <Clock className="h-3 w-3 text-blue-600" />
                    <span className="text-blue-600">Polling</span>
                  </>
                ) : (
                  <span className="text-gray-600">None</span>
                )}
              </p>
            </div>
          </div>

          {/* Enhanced connection information */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Last Connected:</span>
              <p className="font-medium">{formatLastConnected()}</p>
            </div>
            {isPolling && (
              <div>
                <span className="text-muted-foreground">Poll Interval:</span>
                <p className="font-medium">
                  {Math.round(pollingInterval / 1000)}s
                </p>
              </div>
            )}
          </div>

          {/* Polling reason display */}
          {isPolling && pollingReason !== "not_needed" && (
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">
                Polling reason: {pollingReason.replace("_", " ")}
              </span>
            </div>
          )}

          {/* Authentication failure specific message */}
          {isPollingForAuthFailure && (
            <div className="flex items-center space-x-2 p-2 bg-orange-50 rounded-md">
              <Activity className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-orange-700">
                WebSocket authentication failed - using REST API fallback
              </span>
            </div>
          )}

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
