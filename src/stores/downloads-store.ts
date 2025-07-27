import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { type DownloadJob, type DownloadOptions } from '@/lib/types';

interface DownloadsState {
  // Download Jobs
  jobs: DownloadJob[];
  activeJobs: DownloadJob[];
  queuedJobs: DownloadJob[];
  completedJobs: DownloadJob[];
  failedJobs: DownloadJob[];

  // Current Download Options
  defaultOptions: DownloadOptions;

  // UI State
  selectedJobIds: string[];
  showCompletedJobs: boolean;

  // Statistics and Metrics
  stats: {
    totalDownloads: number;
    totalCompleted: number;
    totalFailed: number;
    totalBytes: number;
    downloadedBytes: number;
    avgDownloadSpeed: number;
    estimatedTimeRemaining: number;
  };

  // Queue Management
  maxConcurrentDownloads: number;
  queuePaused: boolean;
  autoRetryFailed: boolean;
  maxRetryAttempts: number;

  // Filters and Sorting
  filters: {
    status: DownloadJob['status'][];
    service: string[];
    dateRange?: { start: Date; end: Date };
  };
  sortBy: 'date' | 'title' | 'service' | 'progress' | 'status';
  sortOrder: 'asc' | 'desc';

  // Actions
  setJobs: (jobs: DownloadJob[]) => void;
  addJob: (job: DownloadJob) => void;
  updateJob: (jobId: string, updates: Partial<DownloadJob>) => void;
  removeJob: (jobId: string) => void;
  
  setDefaultOptions: (options: DownloadOptions) => void;
  
  selectJob: (jobId: string) => void;
  deselectJob: (jobId: string) => void;
  clearSelection: () => void;
  selectAll: (status?: DownloadJob['status']) => void;
  
  setShowCompletedJobs: (show: boolean) => void;
  
  clearCompletedJobs: () => void;
  retryFailedJob: (jobId: string) => void;
  cancelJob: (jobId: string) => void;

  // Enhanced actions
  bulkCancel: (jobIds: string[]) => void;
  bulkRetry: (jobIds: string[]) => void;
  pauseQueue: () => void;
  resumeQueue: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  
  updateStats: () => void;
  getFilteredJobs: () => DownloadJob[];
  getSortedJobs: (jobs: DownloadJob[]) => DownloadJob[];
  
  setMaxConcurrentDownloads: (max: number) => void;
  setAutoRetryFailed: (autoRetry: boolean) => void;
  setMaxRetryAttempts: (max: number) => void;
  
  setFilters: (filters: Partial<DownloadsState['filters']>) => void;
  setSorting: (sortBy: DownloadsState['sortBy'], sortOrder: DownloadsState['sortOrder']) => void;
  clearFilters: () => void;
  
  // WebSocket real-time updates
  handleJobUpdate: (update: Partial<DownloadJob> & { id: string }) => void;
  handleJobProgress: (jobId: string, progress: number, currentFile?: string) => void;
}

const defaultDownloadOptions: DownloadOptions = {
  quality: '1080p',
  hdr10: false,
  dolby_vision: false,
  atmos: false,
  subtitles: true,
  audio_tracks: [],
};

export const useDownloadsStore = create<DownloadsState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        jobs: [],
        activeJobs: [],
        queuedJobs: [],
        completedJobs: [],
        failedJobs: [],

        defaultOptions: defaultDownloadOptions,

        selectedJobIds: [],
        showCompletedJobs: true,

        // New state
        stats: {
          totalDownloads: 0,
          totalCompleted: 0,
          totalFailed: 0,
          totalBytes: 0,
          downloadedBytes: 0,
          avgDownloadSpeed: 0,
          estimatedTimeRemaining: 0,
        },

        maxConcurrentDownloads: 3,
        queuePaused: false,
        autoRetryFailed: true,
        maxRetryAttempts: 3,

        filters: {
          status: ['downloading', 'queued'],
          service: [],
        },
        sortBy: 'date',
        sortOrder: 'desc',

        // Actions
        setJobs: (jobs) => {
          const activeJobs = jobs.filter(job => job.status === 'downloading');
          const queuedJobs = jobs.filter(job => job.status === 'queued');
          const completedJobs = jobs.filter(job => job.status === 'completed');
          const failedJobs = jobs.filter(job => job.status === 'failed');

          set({
            jobs,
            activeJobs,
            queuedJobs,
            completedJobs,
            failedJobs,
          });
        },

        addJob: (job) => {
          const { jobs } = get();
          const newJobs = [job, ...jobs];
          get().setJobs(newJobs);
        },

        updateJob: (jobId, updates) => {
          const { jobs } = get();
          const newJobs = jobs.map(job =>
            job.id === jobId ? { ...job, ...updates } : job
          );
          get().setJobs(newJobs);
        },

        removeJob: (jobId) => {
          const { jobs } = get();
          const newJobs = jobs.filter(job => job.id !== jobId);
          get().setJobs(newJobs);
        },

        setDefaultOptions: (options) => set({ defaultOptions: options }),

        selectJob: (jobId) => {
          const { selectedJobIds } = get();
          if (!selectedJobIds.includes(jobId)) {
            set({ selectedJobIds: [...selectedJobIds, jobId] });
          }
        },

        deselectJob: (jobId) => {
          const { selectedJobIds } = get();
          set({ selectedJobIds: selectedJobIds.filter(id => id !== jobId) });
        },

        clearSelection: () => set({ selectedJobIds: [] }),

        selectAll: (status) => {
          const { jobs } = get();
          const jobIds = status 
            ? jobs.filter(job => job.status === status).map(job => job.id)
            : jobs.map(job => job.id);
          set({ selectedJobIds: jobIds });
        },

        setShowCompletedJobs: (show) => set({ showCompletedJobs: show }),

        clearCompletedJobs: () => {
          const { jobs } = get();
          const newJobs = jobs.filter(job => job.status !== 'completed');
          get().setJobs(newJobs);
        },

        retryFailedJob: (jobId) => {
          get().updateJob(jobId, { 
            status: 'queued', 
            error: undefined,
            progress: 0 
          });
        },

        cancelJob: (jobId) => {
          // Update job status to indicate cancellation in progress
          get().updateJob(jobId, { status: 'failed', error: 'Cancelled by user' });
          // Note: The actual API call is handled by the component using useCancelJob hook
        },

        // Enhanced actions
        bulkCancel: (jobIds) => {
          jobIds.forEach(jobId => get().cancelJob(jobId));
        },

        bulkRetry: (jobIds) => {
          jobIds.forEach(jobId => get().retryFailedJob(jobId));
        },

        pauseQueue: () => set({ queuePaused: true }),
        resumeQueue: () => set({ queuePaused: false }),

        reorderQueue: (fromIndex, toIndex) => {
          const { queuedJobs } = get();
          const newQueue = [...queuedJobs];
          const [removed] = newQueue.splice(fromIndex, 1);
          newQueue.splice(toIndex, 0, removed);
          
          // Update the main jobs array
          const { jobs } = get();
          const newJobs = jobs.map(job => {
            const queueIndex = newQueue.findIndex(q => q.id === job.id);
            return queueIndex !== -1 ? newQueue[queueIndex] : job;
          });
          
          get().setJobs(newJobs);
        },

        updateStats: () => {
          const { jobs } = get();
          
          const stats = {
            totalDownloads: jobs.length,
            totalCompleted: jobs.filter(j => j.status === 'completed').length,
            totalFailed: jobs.filter(j => j.status === 'failed').length,
            totalBytes: jobs.reduce((sum, j) => sum + (j.total_bytes || 0), 0),
            downloadedBytes: jobs.reduce((sum, j) => sum + (j.downloaded_bytes || 0), 0),
            avgDownloadSpeed: 0, // Would need more complex calculation
            estimatedTimeRemaining: 0, // Would need more complex calculation
          };
          
          set({ stats });
        },

        getFilteredJobs: () => {
          const { jobs, filters } = get();
          
          return jobs.filter(job => {
            // Status filter
            if (filters.status.length > 0 && !filters.status.includes(job.status)) {
              return false;
            }
            
            // Service filter
            if (filters.service.length > 0 && !filters.service.includes(job.service)) {
              return false;
            }
            
            // Date range filter
            if (filters.dateRange) {
              const jobDate = new Date(job.start_time);
              if (jobDate < filters.dateRange.start || jobDate > filters.dateRange.end) {
                return false;
              }
            }
            
            return true;
          });
        },

        getSortedJobs: (jobs) => {
          const { sortBy, sortOrder } = get();
          
          return [...jobs].sort((a, b) => {
            let comparison = 0;
            
            switch (sortBy) {
              case 'date':
                comparison = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
                break;
              case 'title':
                comparison = a.content_title.localeCompare(b.content_title);
                break;
              case 'service':
                comparison = a.service.localeCompare(b.service);
                break;
              case 'progress':
                comparison = (a.progress || 0) - (b.progress || 0);
                break;
              case 'status':
                comparison = a.status.localeCompare(b.status);
                break;
            }
            
            return sortOrder === 'asc' ? comparison : -comparison;
          });
        },

        setMaxConcurrentDownloads: (max) => set({ maxConcurrentDownloads: max }),
        setAutoRetryFailed: (autoRetry) => set({ autoRetryFailed: autoRetry }),
        setMaxRetryAttempts: (max) => set({ maxRetryAttempts: max }),

        setFilters: (newFilters) => {
          const { filters } = get();
          set({ filters: { ...filters, ...newFilters } });
        },

        setSorting: (sortBy, sortOrder) => set({ sortBy, sortOrder }),
        
        clearFilters: () => set({
          filters: { status: [], service: [] }
        }),

        handleJobUpdate: (update) => {
          get().updateJob(update.id, update);
          get().updateStats();
        },

        handleJobProgress: (jobId, progress, currentFile) => {
          get().updateJob(jobId, { 
            progress, 
            current_file: currentFile 
          });
          get().updateStats();
        },
      }),
      {
        name: 'unshackle-downloads-store',
        partialize: (state) => ({
          defaultOptions: state.defaultOptions,
          showCompletedJobs: state.showCompletedJobs,
          maxConcurrentDownloads: state.maxConcurrentDownloads,
          autoRetryFailed: state.autoRetryFailed,
          maxRetryAttempts: state.maxRetryAttempts,
          queuePaused: state.queuePaused,
          filters: state.filters,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          // Persist completed jobs for history, but limit to last 100
          jobs: state.jobs.filter(job => 
            job.status === 'completed' || job.status === 'failed'
          ).slice(-100),
        }),
        // Hydrate persisted data on load
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Update computed arrays after hydration
            state.setJobs(state.jobs);
            state.updateStats();
          }
        },
      }
    )
  )
);