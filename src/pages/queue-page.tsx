import { DownloadQueue } from '@/components/downloads/download-queue';
import { useJobs } from '@/lib/api/queries';
import { useDownloadWebSocket } from '@/hooks/use-download-websocket';
import { ConnectionStatusIndicator } from '@/components/layout/connection-status-indicator';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';

export function QueuePage() {
  const { data: jobs = [], isLoading } = useJobs();
  
  // Connect to WebSocket for real-time download updates and get status
  const { isPolling, pollingInterval } = useDownloadWebSocket();
  
  // Filter jobs by status
  const activeJobs = jobs.filter(job => job.status === 'downloading');
  const queuedJobs = jobs.filter(job => job.status === 'queued');
  const totalActiveDownloads = activeJobs.length + queuedJobs.length;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Download Queue</h1>
          {!isLoading && totalActiveDownloads > 0 && (
            <p className="text-muted-foreground mt-1">
              {totalActiveDownloads} download{totalActiveDownloads !== 1 ? 's' : ''} in progress
            </p>
          )}
          {isLoading && (
            <p className="text-muted-foreground mt-1">Loading downloads...</p>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Real-time update status */}
          <div className="flex items-center space-x-2">
            <ConnectionStatusIndicator showDetails />
            {isPolling && (
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span className="text-xs">
                  Polling ({Math.round(pollingInterval / 1000)}s)
                </span>
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      <DownloadQueue />
    </div>
  );
}