import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, FileDown, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { useJobs } from '@/lib/api/queries';
import { useDownloadsStore } from '@/stores/downloads-store';

export function HistoryPage() {
  const { data: jobs = [], isLoading, error } = useJobs();
  const { clearCompletedJobs, stats } = useDownloadsStore();
  
  // Filter for completed and failed jobs (history)
  const historyJobs = jobs.filter(job => 
    job.status === 'completed' || job.status === 'failed'
  ).sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileDown className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Download History</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading ? 'Loading history...' : `${historyJobs.length} completed download${historyJobs.length !== 1 ? 's' : ''} • ${stats.totalCompleted} successful, ${stats.totalFailed} failed`}
          </p>
        </div>
        {!isLoading && historyJobs.length > 0 && (
          <Button variant="outline" onClick={clearCompletedJobs}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear History
          </Button>
        )}
      </div>
      
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="text-muted-foreground">Loading download history...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <XCircle className="h-8 w-8 text-red-500 mx-auto" />
              <p className="text-lg font-medium">Failed to load history</p>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : 'An error occurred while loading download history'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && historyJobs.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <FileDown className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-lg font-medium">No download history</p>
              <p className="text-muted-foreground">
                Your completed and failed downloads will appear here
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && historyJobs.length > 0 && (
        <div className="space-y-4">
          {historyJobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <CardTitle className="text-lg">{job.content_title}</CardTitle>
                      <div className="flex items-center space-x-2 mt-1">
                        <CardDescription className="text-sm font-mono">
                          {job.service}
                        </CardDescription>
                        {getStatusBadge(job.status)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(job.start_time)}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {job.error && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      <strong>Error:</strong> {job.error}
                    </div>
                  )}
                  {job.status === 'completed' && job.total_bytes && (
                    <div className="text-sm text-muted-foreground">
                      Downloaded: {(job.total_bytes / 1024 / 1024 / 1024).toFixed(2)} GB
                    </div>
                  )}
                  {job.end_time && (
                    <div className="text-sm text-muted-foreground">
                      Completed: {formatDate(job.end_time)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}