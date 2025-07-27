import { Download } from 'lucide-react';
import { DownloadJobCard } from './download-job-card';
import { useDownloadsStore } from '@/stores/downloads-store';
import { cn } from '@/lib/utils';

interface DownloadQueueProps {
  className?: string;
}

export function DownloadQueue({ className }: DownloadQueueProps) {
  const { activeJobs, queuedJobs, completedJobs } = useDownloadsStore();
  
  const hasAnyJobs = activeJobs.length > 0 || queuedJobs.length > 0 || completedJobs.length > 0;
  
  return (
    <div className={cn("space-y-6", className)}>
      {/* Active Downloads */}
      {activeJobs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Active Downloads</h2>
          <div className="space-y-2">
            {activeJobs.map((job) => (
              <DownloadJobCard key={job.id} job={job} variant="active" />
            ))}
          </div>
        </section>
      )}
      
      {/* Queued Downloads */}
      {queuedJobs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Queue</h2>
          <div className="space-y-2">
            {queuedJobs.map((job) => (
              <DownloadJobCard key={job.id} job={job} variant="queued" />
            ))}
          </div>
        </section>
      )}
      
      {/* Completed Downloads */}
      {completedJobs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Completed</h2>
          <div className="space-y-2">
            {completedJobs.slice(0, 10).map((job) => (
              <DownloadJobCard key={job.id} job={job} variant="completed" />
            ))}
          </div>
        </section>
      )}
      
      {/* Empty State */}
      {!hasAnyJobs && (
        <div className="text-center py-12">
          <Download className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No downloads yet</h3>
          <p className="text-muted-foreground">
            Start by searching for content to download
          </p>
        </div>
      )}
    </div>
  );
}