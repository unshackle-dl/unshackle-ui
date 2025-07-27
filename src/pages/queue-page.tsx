import { DownloadQueue } from '@/components/downloads/download-queue';
import { useJobs } from '@/lib/api/queries';

export function QueuePage() {
  const { data: jobs = [], isLoading } = useJobs();
  
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
      </div>
      
      <DownloadQueue />
    </div>
  );
}