import { Download, Trash2, RotateCcw, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DownloadJobCard } from './download-job-card';
import { useDownloadsStore } from '@/stores/downloads-store';
import { cn } from '@/lib/utils';

interface DownloadQueueProps {
  className?: string;
}

export function DownloadQueue({ className }: DownloadQueueProps) {
  const { 
    activeJobs, 
    queuedJobs, 
    completedJobs, 
    failedJobs,
    showCompletedJobs,
    queuePaused,
    clearCompletedJobs,
    bulkRetry,
    pauseQueue,
    resumeQueue,
    setShowCompletedJobs,
  } = useDownloadsStore();
  
  const hasAnyJobs = activeJobs.length > 0 || queuedJobs.length > 0 || completedJobs.length > 0 || failedJobs.length > 0;
  const hasFailedJobs = failedJobs.length > 0;
  const hasCompletedJobs = completedJobs.length > 0;
  const hasActiveOrQueued = activeJobs.length > 0 || queuedJobs.length > 0;
  
  return (
    <div className={cn("space-y-6", className)}>
      {/* Queue Controls */}
      {hasAnyJobs && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Download Queue</CardTitle>
              <div className="flex items-center space-x-2">
                {hasActiveOrQueued && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={queuePaused ? resumeQueue : pauseQueue}
                  >
                    {queuePaused ? (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </>
                    )}
                  </Button>
                )}
                
                {hasFailedJobs && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => bulkRetry(failedJobs.map(j => j.id))}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry All Failed
                  </Button>
                )}
                
                {hasCompletedJobs && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearCompletedJobs}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Completed
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          {/* Queue Stats */}
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                <div className="font-medium text-blue-700 dark:text-blue-300">Active</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{activeJobs.length}</div>
              </div>
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-950/20 rounded">
                <div className="font-medium text-gray-700 dark:text-gray-300">Queued</div>
                <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{queuedJobs.length}</div>
              </div>
              <div className="text-center p-2 bg-green-50 dark:bg-green-950/20 rounded">
                <div className="font-medium text-green-700 dark:text-green-300">Completed</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completedJobs.length}</div>
              </div>
              <div className="text-center p-2 bg-red-50 dark:bg-red-950/20 rounded">
                <div className="font-medium text-red-700 dark:text-red-300">Failed</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{failedJobs.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Downloads */}
      {activeJobs.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Active Downloads</h2>
            {queuePaused && (
              <div className="text-sm text-orange-600 dark:text-orange-400 flex items-center">
                <Pause className="h-4 w-4 mr-1" />
                Queue Paused
              </div>
            )}
          </div>
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
      
      {/* Failed Downloads */}
      {failedJobs.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Failed Downloads</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkRetry(failedJobs.map(j => j.id))}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry All
            </Button>
          </div>
          <div className="space-y-2">
            {failedJobs.map((job) => (
              <DownloadJobCard key={job.id} job={job} variant="failed" />
            ))}
          </div>
        </section>
      )}

      {/* Completed Downloads */}
      {completedJobs.length > 0 && showCompletedJobs && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Completed</h2>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCompletedJobs(false)}
              >
                Hide Completed
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearCompletedJobs}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {completedJobs.slice(0, 10).map((job) => (
              <DownloadJobCard key={job.id} job={job} variant="completed" />
            ))}
            {completedJobs.length > 10 && (
              <div className="text-center py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCompletedJobs(true)}
                >
                  Show all {completedJobs.length} completed downloads
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Show Completed Toggle */}
      {completedJobs.length > 0 && !showCompletedJobs && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => setShowCompletedJobs(true)}
          >
            Show {completedJobs.length} completed downloads
          </Button>
        </div>
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