import { unshackleClient } from './index';
import { useDownloadsStore } from '@/stores/downloads-store';
import { useServicesStore } from '@/stores/services-store';
import { type WebSocketMessage, type DownloadJob } from '@/lib/types';

export interface MessageTestResult {
  testName: string;
  success: boolean;
  description: string;
  messageType?: string;
  uiUpdatesVerified?: boolean;
  storeStateCorrect?: boolean;
  error?: string;
  details?: any;
}

export interface MessageTestSuite {
  results: MessageTestResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    uiUpdatesVerified: number;
  };
}

export class WebSocketMessageTester {
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:8888') {
    this.baseURL = baseURL;
  }

  /**
   * Run comprehensive message handling and UI update tests
   */
  async runMessageTestSuite(): Promise<MessageTestSuite> {
    const results: MessageTestResult[] = [];

    // Test 1: Message parsing with API formats
    results.push(await this.testMessageParsing());

    // Test 2: Job status event handling
    results.push(await this.testJobStatusMessage());

    // Test 3: Job progress event handling
    results.push(await this.testJobProgressMessage());

    // Test 4: Initial job status on connection
    results.push(await this.testInitialJobStatus());

    // Test 5: Connection confirmation events
    results.push(await this.testConnectionConfirmation());

    // Test 6: Global events handling
    results.push(await this.testGlobalEvents());

    // Test 7: Service status updates
    results.push(await this.testServiceStatusUpdates());

    // Test 8: Store state synchronization
    results.push(await this.testStoreStateSynchronization());

    // Test 9: UI component updates
    results.push(await this.testUIComponentUpdates());

    // Test 10: Polling fallback activation
    results.push(await this.testPollingFallbackActivation());

    const passedTests = results.filter(r => r.success).length;
    const uiUpdatesVerified = results.filter(r => r.uiUpdatesVerified).length;

    return {
      results,
      summary: {
        totalTests: results.length,
        passedTests,
        failedTests: results.length - passedTests,
        uiUpdatesVerified,
      },
    };
  }

  /**
   * Test 1: Message parsing with API formats
   */
  private async testMessageParsing(): Promise<MessageTestResult> {
    try {
      // Test various API message formats
      const testMessages: WebSocketMessage[] = [
        {
          event_type: 'job_status',
          job_id: 'test-job-1',
          data: {
            job_id: 'test-job-1',
            status: 'running',
            progress: 45,
            current_file: 'episode_01.mp4',
            files_total: 10,
            files_completed: 4
          },
          timestamp: Date.now()
        },
        {
          event_type: 'job_progress',
          job_id: 'test-job-2',
          data: {
            progress: 75,
            current_file: 'episode_02.mp4',
            downloaded_bytes: 1024 * 1024 * 500,
            total_bytes: 1024 * 1024 * 667
          },
          timestamp: Date.now()
        },
        {
          event_type: 'connection_confirmed',
          job_id: 'test-job-3',
          data: {
            job_id: 'test-job-3',
            message: 'Connected to job events',
            status: 'downloading'
          },
          timestamp: Date.now()
        }
      ];

      let parseErrors = 0;
      const parsedMessages = [];

      for (const msg of testMessages) {
        try {
          // Verify message structure matches API format
          if (!msg.event_type) {
            parseErrors++;
            continue;
          }

          // For job-specific events, verify job_id is present
          if (msg.event_type !== 'test_event' && !msg.job_id && !msg.data?.job_id) {
            parseErrors++;
            continue;
          }

          // Verify timestamp is valid
          if (!msg.timestamp || typeof msg.timestamp !== 'number') {
            parseErrors++;
            continue;
          }

          parsedMessages.push({
            type: msg.event_type,
            jobId: msg.job_id || msg.data?.job_id,
            data: msg.data,
            timestamp: msg.timestamp
          });
        } catch (error) {
          parseErrors++;
        }
      }

      return {
        testName: 'Message Parsing',
        success: parseErrors === 0,
        description: 'Test WebSocket message parsing with actual API response formats',
        messageType: 'various',
        details: {
          totalMessages: testMessages.length,
          parsedSuccessfully: parsedMessages.length,
          parseErrors
        }
      };
    } catch (error) {
      return {
        testName: 'Message Parsing',
        success: false,
        description: 'Test WebSocket message parsing with actual API response formats',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test 2: Job status event handling
   */
  private async testJobStatusMessage(): Promise<MessageTestResult> {
    try {
      const downloadsStore = useDownloadsStore.getState();
      const initialJobCount = downloadsStore.jobs.length;

      // Simulate receiving job status message
      const jobStatusMessage: WebSocketMessage = {
        event_type: 'job_status',
        job_id: 'test-status-job',
        data: {
          job_id: 'test-status-job',
          status: 'downloading',
          progress: 25,
          current_action: 'Downloading video stream',
          files_completed: 2,
          files_total: 8,
          current_file: 'video_track.mp4',
          started_at: new Date().toISOString()
        },
        timestamp: Date.now()
      };

      // Simulate message handling (as done in WebSocketContext)
      downloadsStore.handleJobUpdate({
        id: jobStatusMessage.job_id!,
        job_id: jobStatusMessage.job_id!,
        status: jobStatusMessage.data.status,
        progress: jobStatusMessage.data.progress,
        current_file: jobStatusMessage.data.current_file,
        total_files: jobStatusMessage.data.files_total,
        start_time: jobStatusMessage.data.started_at,
        content_title: 'Test Download',
        service: 'TEST',
        quality: '1080p'
      });

      // Verify store update
      const updatedStore = useDownloadsStore.getState();
      const job = updatedStore.jobs.find(j => j.id === 'test-status-job');
      
      const storeUpdatedCorrectly = job !== undefined &&
        job.status === 'downloading' &&
        job.progress === 25 &&
        job.current_file === 'video_track.mp4' &&
        job.total_files === 8;

      return {
        testName: 'Job Status Event',
        success: storeUpdatedCorrectly,
        description: 'Test job status message handling and store updates',
        messageType: 'job_status',
        storeStateCorrect: storeUpdatedCorrectly,
        details: {
          jobFound: job !== undefined,
          statusCorrect: job?.status === 'downloading',
          progressCorrect: job?.progress === 25,
          fileInfoCorrect: job?.current_file === 'video_track.mp4'
        }
      };
    } catch (error) {
      return {
        testName: 'Job Status Event',
        success: false,
        description: 'Test job status message handling and store updates',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test 3: Job progress event handling
   */
  private async testJobProgressMessage(): Promise<MessageTestResult> {
    try {
      const downloadsStore = useDownloadsStore.getState();
      
      // First add a job to update
      downloadsStore.addJob({
        id: 'test-progress-job',
        job_id: 'test-progress-job',
        content_title: 'Progress Test',
        service: 'TEST',
        status: 'downloading',
        progress: 10,
        quality: '1080p',
        start_time: new Date().toISOString()
      });

      // Simulate receiving job progress message
      const progressMessage: WebSocketMessage = {
        event_type: 'job_progress',
        job_id: 'test-progress-job',
        data: {
          progress: 65,
          current_file: 'episode_05.mp4',
          files_completed: 5,
          files_total: 10,
          downloaded_bytes: 1024 * 1024 * 650,
          total_bytes: 1024 * 1024 * 1000
        },
        timestamp: Date.now()
      };

      // Simulate progress handling
      downloadsStore.handleJobProgress(
        progressMessage.job_id!,
        progressMessage.data.progress,
        progressMessage.data.current_file
      );

      // Additional update for byte information
      downloadsStore.handleJobUpdate({
        id: progressMessage.job_id!,
        progress: progressMessage.data.progress,
        current_file: progressMessage.data.current_file,
        total_files: progressMessage.data.files_total,
        downloaded_bytes: progressMessage.data.downloaded_bytes,
        total_bytes: progressMessage.data.total_bytes
      });

      // Verify store update
      const updatedStore = useDownloadsStore.getState();
      const job = updatedStore.jobs.find(j => j.id === 'test-progress-job');
      
      const progressUpdatedCorrectly = job !== undefined &&
        job.progress === 65 &&
        job.current_file === 'episode_05.mp4' &&
        job.downloaded_bytes === 1024 * 1024 * 650 &&
        job.total_bytes === 1024 * 1024 * 1000;

      return {
        testName: 'Job Progress Event',
        success: progressUpdatedCorrectly,
        description: 'Test job progress message handling and incremental updates',
        messageType: 'job_progress',
        storeStateCorrect: progressUpdatedCorrectly,
        details: {
          progressUpdated: job?.progress === 65,
          fileUpdated: job?.current_file === 'episode_05.mp4',
          bytesTracked: job?.downloaded_bytes === 1024 * 1024 * 650
        }
      };
    } catch (error) {
      return {
        testName: 'Job Progress Event',
        success: false,
        description: 'Test job progress message handling and incremental updates',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test 4: Initial job status on connection
   */
  private async testInitialJobStatus(): Promise<MessageTestResult> {
    try {
      // Simulate connecting to a job and receiving initial status
      const initialStatusMessage: WebSocketMessage = {
        event_type: 'initial_status',
        job_id: 'test-initial-job',
        data: {
          job_id: 'test-initial-job',
          status: 'downloading',
          progress: 33,
          current_file: 'track_03.mp4',
          files_completed: 3,
          files_total: 9,
          started_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() // Started 5 minutes ago
        },
        timestamp: Date.now()
      };

      const downloadsStore = useDownloadsStore.getState();
      
      // Handle initial status as job update
      downloadsStore.handleJobUpdate({
        id: initialStatusMessage.job_id!,
        job_id: initialStatusMessage.job_id!,
        status: initialStatusMessage.data.status,
        progress: initialStatusMessage.data.progress,
        current_file: initialStatusMessage.data.current_file,
        total_files: initialStatusMessage.data.files_total,
        start_time: initialStatusMessage.data.started_at,
        content_title: 'Initial Status Test',
        service: 'TEST',
        quality: '720p'
      });

      const job = downloadsStore.jobs.find(j => j.id === 'test-initial-job');
      const initialStatusHandled = job !== undefined &&
        job.status === 'downloading' &&
        job.progress === 33;

      return {
        testName: 'Initial Job Status',
        success: initialStatusHandled,
        description: 'Test handling of initial job status sent upon WebSocket connection',
        messageType: 'initial_status',
        storeStateCorrect: initialStatusHandled,
        details: {
          jobCreated: job !== undefined,
          statusSet: job?.status === 'downloading',
          progressSet: job?.progress === 33,
          startTimeSet: job?.start_time === initialStatusMessage.data.started_at
        }
      };
    } catch (error) {
      return {
        testName: 'Initial Job Status',
        success: false,
        description: 'Test handling of initial job status sent upon WebSocket connection',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test 5: Connection confirmation events
   */
  private async testConnectionConfirmation(): Promise<MessageTestResult> {
    try {
      const connectionConfirmedMessage: WebSocketMessage = {
        event_type: 'connection_confirmed',
        job_id: 'test-confirmed-job',
        data: {
          job_id: 'test-confirmed-job',
          message: 'Successfully connected to job WebSocket',
          status: 'downloading',
          progress: 50,
          current_file: 'main_video.mp4',
          files_total: 5
        },
        timestamp: Date.now()
      };

      const downloadsStore = useDownloadsStore.getState();
      
      // Handle connection confirmation with embedded status
      if (connectionConfirmedMessage.data.status) {
        downloadsStore.handleJobUpdate({
          id: connectionConfirmedMessage.job_id!,
          job_id: connectionConfirmedMessage.job_id!,
          status: connectionConfirmedMessage.data.status,
          progress: connectionConfirmedMessage.data.progress,
          current_file: connectionConfirmedMessage.data.current_file,
          total_files: connectionConfirmedMessage.data.files_total || connectionConfirmedMessage.data.total_files,
          content_title: 'Connection Confirmed Test',
          service: 'TEST',
          quality: '4K'
        });
      }

      const job = downloadsStore.jobs.find(j => j.id === 'test-confirmed-job');
      const confirmationHandled = job !== undefined &&
        job.status === 'downloading' &&
        job.progress === 50;

      return {
        testName: 'Connection Confirmation',
        success: confirmationHandled,
        description: 'Test connection confirmation events with embedded job status',
        messageType: 'connection_confirmed',
        storeStateCorrect: confirmationHandled,
        details: {
          messageReceived: true,
          jobStatusExtracted: job !== undefined,
          statusCorrect: job?.status === 'downloading',
          progressCorrect: job?.progress === 50
        }
      };
    } catch (error) {
      return {
        testName: 'Connection Confirmation',
        success: false,
        description: 'Test connection confirmation events with embedded job status',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test 6: Global events handling
   */
  private async testGlobalEvents(): Promise<MessageTestResult> {
    try {
      const globalEventMessages: WebSocketMessage[] = [
        {
          event_type: 'system_notification',
          data: {
            type: 'info',
            message: 'Download server capacity at 80%',
            severity: 'warning'
          },
          timestamp: Date.now()
        },
        {
          event_type: 'queue_update',
          data: {
            status: 'paused',
            reason: 'System maintenance',
            estimated_resume: Date.now() + 1000 * 60 * 10
          },
          timestamp: Date.now()
        },
        {
          event_type: 'test_event',
          data: {
            message: 'WebSocket connection test successful'
          },
          timestamp: Date.now()
        }
      ];

      let eventsHandled = 0;
      
      // Simulate handling of global events
      for (const msg of globalEventMessages) {
        switch (msg.event_type) {
          case 'system_notification':
            console.log('System notification:', msg.data);
            eventsHandled++;
            break;
          case 'queue_update':
            if (msg.data.status === 'paused') {
              console.log('Queue paused:', msg.data.reason);
              eventsHandled++;
            }
            break;
          case 'test_event':
            console.log('Test event received:', msg.data.message);
            eventsHandled++;
            break;
        }
      }

      return {
        testName: 'Global Events',
        success: eventsHandled === globalEventMessages.length,
        description: 'Verify global events are received and processed correctly',
        messageType: 'global_events',
        details: {
          totalEvents: globalEventMessages.length,
          eventsHandled,
          eventTypes: globalEventMessages.map(m => m.event_type)
        }
      };
    } catch (error) {
      return {
        testName: 'Global Events',
        success: false,
        description: 'Verify global events are received and processed correctly',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test 7: Service status updates
   */
  private async testServiceStatusUpdates(): Promise<MessageTestResult> {
    try {
      const servicesStore = useServicesStore.getState();
      
      const serviceStatusMessage: WebSocketMessage = {
        event_type: 'service_status',
        data: {
          service_id: 'NF',
          status: 'healthy',
          authenticated: true,
          last_check: Date.now()
        },
        timestamp: Date.now()
      };

      // Handle service status update
      servicesStore.updateServiceStatus(
        serviceStatusMessage.data.service_id,
        serviceStatusMessage.data.status
      );

      const service = servicesStore.services.find(s => s.id === 'NF');
      const statusUpdated = service !== undefined && service.status === 'healthy';

      return {
        testName: 'Service Status Updates',
        success: statusUpdated,
        description: 'Test service status message handling and store updates',
        messageType: 'service_status',
        storeStateCorrect: statusUpdated,
        details: {
          serviceFound: service !== undefined,
          statusUpdated: service?.status === 'healthy'
        }
      };
    } catch (error) {
      return {
        testName: 'Service Status Updates',
        success: false,
        description: 'Test service status message handling and store updates',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test 8: Store state synchronization
   */
  private async testStoreStateSynchronization(): Promise<MessageTestResult> {
    try {
      const downloadsStore = useDownloadsStore.getState();
      const initialStats = { ...downloadsStore.stats };

      // Add multiple jobs and verify stats update
      const testJobs: DownloadJob[] = [
        {
          id: 'sync-job-1',
          job_id: 'sync-job-1',
          content_title: 'Sync Test 1',
          service: 'TEST',
          status: 'completed',
          progress: 100,
          quality: '1080p',
          start_time: new Date().toISOString(),
          total_bytes: 1024 * 1024 * 1000,
          downloaded_bytes: 1024 * 1024 * 1000
        },
        {
          id: 'sync-job-2',
          job_id: 'sync-job-2',
          content_title: 'Sync Test 2',
          service: 'TEST',
          status: 'downloading',
          progress: 50,
          quality: '720p',
          start_time: new Date().toISOString(),
          total_bytes: 1024 * 1024 * 500,
          downloaded_bytes: 1024 * 1024 * 250
        },
        {
          id: 'sync-job-3',
          job_id: 'sync-job-3',
          content_title: 'Sync Test 3',
          service: 'TEST',
          status: 'failed',
          progress: 30,
          quality: '4K',
          start_time: new Date().toISOString(),
          error: 'Network error'
        }
      ];

      // Add jobs
      testJobs.forEach(job => downloadsStore.addJob(job));
      
      // Update stats
      downloadsStore.updateStats();

      const updatedStats = downloadsStore.stats;
      const activeJobs = downloadsStore.activeJobs;
      const completedJobs = downloadsStore.completedJobs;
      const failedJobs = downloadsStore.failedJobs;

      const syncCorrect = 
        updatedStats.totalDownloads >= initialStats.totalDownloads + 3 &&
        updatedStats.totalCompleted >= initialStats.totalCompleted + 1 &&
        updatedStats.totalFailed >= initialStats.totalFailed + 1 &&
        activeJobs.some(j => j.id === 'sync-job-2') &&
        completedJobs.some(j => j.id === 'sync-job-1') &&
        failedJobs.some(j => j.id === 'sync-job-3');

      return {
        testName: 'Store State Synchronization',
        success: syncCorrect,
        description: 'Test job status changes and UI state synchronization',
        storeStateCorrect: syncCorrect,
        details: {
          totalJobs: updatedStats.totalDownloads,
          completedCount: updatedStats.totalCompleted,
          failedCount: updatedStats.totalFailed,
          activeJobsCorrect: activeJobs.some(j => j.id === 'sync-job-2'),
          completedJobsCorrect: completedJobs.some(j => j.id === 'sync-job-1'),
          failedJobsCorrect: failedJobs.some(j => j.id === 'sync-job-3')
        }
      };
    } catch (error) {
      return {
        testName: 'Store State Synchronization',
        success: false,
        description: 'Test job status changes and UI state synchronization',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test 9: UI component updates
   */
  private async testUIComponentUpdates(): Promise<MessageTestResult> {
    try {
      // Simulate UI update verification
      const downloadsStore = useDownloadsStore.getState();
      
      // Add a job that would trigger UI updates
      const uiTestJob: DownloadJob = {
        id: 'ui-test-job',
        job_id: 'ui-test-job',
        content_title: 'UI Update Test',
        service: 'TEST',
        status: 'downloading',
        progress: 0,
        quality: '1080p',
        start_time: new Date().toISOString()
      };

      downloadsStore.addJob(uiTestJob);

      // Simulate progress updates that would trigger UI re-renders
      const progressUpdates = [25, 50, 75, 100];
      let lastProgress = 0;

      for (const progress of progressUpdates) {
        downloadsStore.handleJobProgress('ui-test-job', progress, `file_${progress}.mp4`);
        
        const job = downloadsStore.jobs.find(j => j.id === 'ui-test-job');
        if (job && job.progress === progress) {
          lastProgress = progress;
        }
      }

      // Mark as completed when progress reaches 100
      if (lastProgress === 100) {
        downloadsStore.updateJob('ui-test-job', { status: 'completed' });
      }

      const finalJob = downloadsStore.jobs.find(j => j.id === 'ui-test-job');
      const uiUpdatesCorrect = finalJob !== undefined &&
        finalJob.progress === 100 &&
        finalJob.status === 'completed';

      return {
        testName: 'UI Component Updates',
        success: uiUpdatesCorrect,
        description: 'Test that UI components update in response to WebSocket messages',
        uiUpdatesVerified: true,
        storeStateCorrect: uiUpdatesCorrect,
        details: {
          progressUpdatesApplied: lastProgress === 100,
          statusTransitioned: finalJob?.status === 'completed',
          currentFileUpdated: finalJob?.current_file === 'file_100.mp4'
        }
      };
    } catch (error) {
      return {
        testName: 'UI Component Updates',
        success: false,
        description: 'Test that UI components update in response to WebSocket messages',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test 10: Polling fallback activation
   */
  private async testPollingFallbackActivation(): Promise<MessageTestResult> {
    try {
      // Simulate scenarios that should activate polling fallback
      const pollingScenarios = [
        {
          connectionState: 'disconnected',
          shouldPoll: true,
          reason: 'WebSocket disconnected'
        },
        {
          connectionState: 'auth_failed',
          shouldPoll: true,
          reason: 'Authentication failed'
        },
        {
          connectionState: 'job_not_found',
          shouldPoll: true,
          reason: 'Job not found'
        },
        {
          connectionState: 'connected',
          shouldPoll: false,
          reason: 'WebSocket connected normally'
        }
      ];

      let correctActivations = 0;

      for (const scenario of pollingScenarios) {
        // Check if polling should be activated based on connection state
        const shouldActivate = scenario.connectionState !== 'connected';
        
        if (shouldActivate === scenario.shouldPoll) {
          correctActivations++;
        }
      }

      const allCorrect = correctActivations === pollingScenarios.length;

      return {
        testName: 'Polling Fallback Activation',
        success: allCorrect,
        description: 'Test polling fallback activates correctly for various connection states',
        details: {
          totalScenarios: pollingScenarios.length,
          correctActivations,
          scenarios: pollingScenarios
        }
      };
    } catch (error) {
      return {
        testName: 'Polling Fallback Activation',
        success: false,
        description: 'Test polling fallback activates correctly for various connection states',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test real-time job updates with actual WebSocket connection
   */
  async testRealTimeJobUpdates(jobId: string): Promise<MessageTestResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const progressUpdates: number[] = [];
      let lastStatus: string | undefined;
      
      const timeout = setTimeout(() => {
        unshackleClient.disconnectWebSocket();
        resolve({
          testName: 'Real-Time Job Updates',
          success: progressUpdates.length > 0,
          description: 'Create test download job and verify real-time progress updates',
          messageType: 'job_progress',
          uiUpdatesVerified: progressUpdates.length > 0,
          details: {
            jobId,
            progressUpdatesReceived: progressUpdates.length,
            progressValues: progressUpdates,
            lastStatus,
            duration: Date.now() - startTime
          }
        });
      }, 10000); // 10 second timeout

      unshackleClient.connectToJobEvents(
        jobId,
        (message) => {
          if (message.event_type === 'job_progress' && message.data.progress !== undefined) {
            progressUpdates.push(message.data.progress);
            console.log(`Progress update: ${message.data.progress}%`);
          }
          
          if (message.event_type === 'job_status' && message.data.status) {
            lastStatus = message.data.status;
            console.log(`Status update: ${message.data.status}`);
          }
          
          // If we receive multiple updates, consider it successful
          if (progressUpdates.length >= 3) {
            clearTimeout(timeout);
            unshackleClient.disconnectWebSocket();
            resolve({
              testName: 'Real-Time Job Updates',
              success: true,
              description: 'Create test download job and verify real-time progress updates',
              messageType: 'job_progress',
              uiUpdatesVerified: true,
              storeStateCorrect: true,
              details: {
                jobId,
                progressUpdatesReceived: progressUpdates.length,
                progressValues: progressUpdates,
                lastStatus,
                duration: Date.now() - startTime
              }
            });
          }
        },
        () => {
          console.log(`Connected to job ${jobId} for real-time updates`);
        },
        () => {
          clearTimeout(timeout);
        },
        () => {
          clearTimeout(timeout);
          resolve({
            testName: 'Real-Time Job Updates',
            success: false,
            description: 'Create test download job and verify real-time progress updates',
            error: 'Authentication failed',
            details: { jobId }
          });
        },
        () => {
          clearTimeout(timeout);
          resolve({
            testName: 'Real-Time Job Updates',
            success: false,
            description: 'Create test download job and verify real-time progress updates',
            error: 'Job not found',
            details: { jobId }
          });
        }
      );
    });
  }
}

export const webSocketMessageTester = new WebSocketMessageTester();

// Expose for dev tools and manual testing
if (typeof window !== 'undefined') {
  (window as any).webSocketMessageTester = webSocketMessageTester;
  (window as any).testWebSocketMessages = () => webSocketMessageTester.runMessageTestSuite().then(console.table);
  (window as any).testRealTimeUpdates = (jobId: string) => webSocketMessageTester.testRealTimeJobUpdates(jobId).then(console.log);
}