import { DownloadQueue } from '@/components/downloads/download-queue';
import { useDownloadsStore } from '@/stores/downloads-store';

export function QueuePage() {
  const { activeJobs, queuedJobs } = useDownloadsStore();
  const totalActiveDownloads = activeJobs.length + queuedJobs.length;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Download Queue</h1>
          {totalActiveDownloads > 0 && (
            <p className="text-muted-foreground mt-1">
              {totalActiveDownloads} download{totalActiveDownloads !== 1 ? 's' : ''} in progress
            </p>
          )}
        </div>
      </div>
      
      <DownloadQueue />
    </div>
  );
}