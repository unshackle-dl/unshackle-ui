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
          // TODO: Implement API call to cancel job
          console.log('Cancelling job:', jobId);
          get().removeJob(jobId);
        },
      }),
      {
        name: 'unshackle-downloads-store',
        partialize: (state) => ({
          defaultOptions: state.defaultOptions,
          showCompletedJobs: state.showCompletedJobs,
          // Don't persist jobs - they should be loaded fresh from API
        }),
      }
    )
  )
);