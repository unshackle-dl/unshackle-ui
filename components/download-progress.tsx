'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  Pause,
  Play,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCw,
  Monitor,
  Activity,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useDownload } from '@/lib/hooks/use-download';
import { DownloadJob } from '@/lib/services/unshackle-api';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { useToast } from '@/lib/hooks/use-toast';

interface DownloadProgressProps {
  className?: string;
}

export function DownloadProgress({ className = '' }: DownloadProgressProps) {
  const { toast } = useToast();
  
  const {
    activeJob,
    queue,
    completed,
    isConnected,
    cancelJob,
    clearCompleted,
    refreshQueue,
    error,
  } = useDownload({
    onError: (error) => {
      toast({
        title: "Download Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onProgress: (jobId, progress) => {
      console.log(`Download ${jobId} progress: ${progress}%`);
    },
    onComplete: (jobId) => {
      toast({
        title: "Download Complete",
        description: "Your download has finished successfully!",
        variant: "success",
      });
    },
  });

  const formatBytes = (bytes: string | undefined): string => {
    if (!bytes) return 'Unknown';
    return bytes; // Already formatted by the API
  };

  const formatSpeed = (speed: string | undefined): string => {
    if (!speed) return 'Unknown';
    return speed; // Already formatted by the API
  };

  const formatDuration = (startedAt: string | undefined): string => {
    if (!startedAt) return 'Unknown';
    
    const start = new Date(startedAt);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };

  const getStatusIcon = (status: DownloadJob['status']) => {
    switch (status) {
      case 'downloading':
        return <Activity className="h-4 w-4 animate-pulse text-blue-500" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <X className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: DownloadJob['status']) => {
    switch (status) {
      case 'downloading':
        return 'bg-blue-100 text-blue-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelJob(jobId);
    } catch (error) {
      console.error('Failed to cancel job:', error);
    }
  };

  const handleClearCompleted = async () => {
    try {
      await clearCompleted();
    } catch (error) {
      console.error('Failed to clear completed jobs:', error);
    }
  };

  const allJobs = [
    ...(activeJob ? [activeJob] : []),
    ...queue,
    ...completed,
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Manager
            <div className="flex items-center ml-auto gap-2">
              {isConnected ? (
                <>
                  <Wifi className="h-4 w-4 text-green-500" />
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Connected
                  </Badge>
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <Badge variant="secondary" className="bg-red-100 text-red-800">
                    Disconnected
                  </Badge>
                </>
              )}
              <Button
                onClick={refreshQueue}
                variant="outline"
                size="sm"
                className="ml-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        {error && (
          <CardContent className="pt-0">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </CardContent>
        )}

        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {activeJob ? 1 : 0}
              </div>
              <div className="text-sm text-muted-foreground">Active</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {queue.length}
              </div>
              <div className="text-sm text-muted-foreground">Queued</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {completed.filter(job => job.status === 'completed').length}
              </div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {completed.filter(job => job.status === 'failed').length}
              </div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Download */}
      {activeJob && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 animate-pulse text-blue-500" />
              Active Download
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{activeJob.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{activeJob.service}</Badge>
                  <Badge className={getStatusColor(activeJob.status)}>
                    {activeJob.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <ConfirmationDialog
                title="Cancel Download"
                description={`Are you sure you want to cancel the download of "${activeJob.title}"? This action cannot be undone.`}
                confirmText="Cancel Download"
                variant="destructive"
                onConfirm={() => handleCancelJob(activeJob.job_id)}
              >
                <Button variant="outline" size="sm">
                  <X className="h-4 w-4" />
                </Button>
              </ConfirmationDialog>
            </div>

            {activeJob.current_track && (
              <div className="text-sm text-muted-foreground">
                <Monitor className="h-4 w-4 inline mr-1" />
                {activeJob.current_track}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(activeJob.progress || 0)}%</span>
              </div>
              <Progress value={activeJob.progress || 0} className="w-full" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Speed: </span>
                <span className="font-medium">{formatSpeed(activeJob.speed)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Downloaded: </span>
                <span className="font-medium">{formatBytes(activeJob.downloaded)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-medium">{formatBytes(activeJob.total)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Running: </span>
                <span className="font-medium">{formatDuration(activeJob.started_at)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue and History */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Download Queue & History
          </CardTitle>
          {completed.length > 0 && (
            <ConfirmationDialog
              title="Clear Completed Downloads"
              description={`Are you sure you want to clear all ${completed.length} completed download${completed.length !== 1 ? 's' : ''}? This will remove them from the history but won't delete the downloaded files.`}
              confirmText="Clear History"
              variant="destructive"
              onConfirm={handleClearCompleted}
            >
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4" />
                Clear Completed
              </Button>
            </ConfirmationDialog>
          )}
        </CardHeader>
        <CardContent>
          {allJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Download className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No downloads yet</p>
              <p className="text-sm">Downloads will appear here when started</p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {allJobs.map((job) => (
                  <div key={job.job_id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(job.status)}
                          <h4 className="font-medium truncate">{job.title}</h4>
                          <Badge className={getStatusColor(job.status)}>
                            {job.status.toUpperCase()}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{job.service}</Badge>
                          {job.position && (
                            <Badge variant="secondary">
                              #{job.position} in queue
                            </Badge>
                          )}
                        </div>

                        {job.status === 'downloading' && job.progress !== undefined && (
                          <div className="space-y-1">
                            <Progress value={job.progress} className="w-full" />
                            <div className="text-xs text-muted-foreground">
                              {Math.round(job.progress)}% • {formatSpeed(job.speed)} • {formatBytes(job.downloaded)} / {formatBytes(job.total)}
                            </div>
                          </div>
                        )}

                        {job.current_track && (
                          <div className="text-xs text-muted-foreground mt-1">
                            <Monitor className="h-3 w-3 inline mr-1" />
                            {job.current_track}
                          </div>
                        )}

                        {job.error_message && (
                          <div className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded">
                            {job.error_message}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground mt-2">
                          {job.started_at && (
                            <span>Started: {new Date(job.started_at).toLocaleString()}</span>
                          )}
                          {job.completed_at && (
                            <span className="ml-4">Completed: {new Date(job.completed_at).toLocaleString()}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {(job.status === 'downloading' || job.status === 'queued') && (
                          <ConfirmationDialog
                            title="Cancel Download"
                            description={`Are you sure you want to cancel "${job.title}"? This action cannot be undone.`}
                            confirmText="Cancel"
                            variant="destructive"
                            onConfirm={() => handleCancelJob(job.job_id)}
                          >
                            <Button variant="outline" size="sm">
                              <X className="h-4 w-4" />
                            </Button>
                          </ConfirmationDialog>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}