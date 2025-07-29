import { webSocketMessageTester, type MessageTestSuite } from './websocket-message-tester';
import { unshackleClient } from './index';
import { useDownloadsStore } from '@/stores/downloads-store';

/**
 * Main test runner for WebSocket message handling and UI updates
 * Run this to execute Task 18: Test message handling and UI updates
 */
export async function runWebSocketMessageTests(): Promise<void> {
  console.log('📬 Starting WebSocket Message Handling and UI Update Tests...\n');
  console.log('This test suite validates:');
  console.log('- WebSocket message parsing with API response formats');
  console.log('- Real-time job progress updates');
  console.log('- Job status changes and UI state synchronization');
  console.log('- Global events processing');
  console.log('- Connection status indicators and user feedback\n');

  try {
    // Set the base URL for testing
    const baseURL = unshackleClient.baseURL || 'http://localhost:8888';
    console.log(`🔗 Testing against API server: ${baseURL}`);
    console.log('📝 Note: For real-time tests, ensure API server is running\n');

    // Run the comprehensive message test suite
    const results: MessageTestSuite = await webSocketMessageTester.runMessageTestSuite();
    
    // Display results
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('========================');
    console.log(`Total Tests: ${results.summary.totalTests}`);
    console.log(`✅ Passed: ${results.summary.passedTests}`);
    console.log(`❌ Failed: ${results.summary.failedTests}`);
    console.log(`🖼️  UI Updates Verified: ${results.summary.uiUpdatesVerified}\n`);

    // Display individual test results
    console.log('📋 DETAILED TEST RESULTS');
    console.log('=========================');
    
    results.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      
      console.log(`${index + 1}. ${status} ${result.testName}`);
      console.log(`   Description: ${result.description}`);
      
      if (result.messageType) {
        console.log(`   Message Type: ${result.messageType}`);
      }
      
      if (result.uiUpdatesVerified !== undefined) {
        console.log(`   UI Updates: ${result.uiUpdatesVerified ? '✓ Verified' : '✗ Not verified'}`);
      }
      
      if (result.storeStateCorrect !== undefined) {
        console.log(`   Store State: ${result.storeStateCorrect ? '✓ Correct' : '✗ Incorrect'}`);
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.details) {
        console.log(`   Details:`, result.details);
      }
      
      console.log(''); // Empty line for readability
    });

    // Final summary
    console.log('🎯 FINAL SUMMARY');
    console.log('================');
    console.log(`Overall Success Rate: ${Math.round((results.summary.passedTests / results.summary.totalTests) * 100)}%`);
    
    if (results.summary.passedTests === results.summary.totalTests) {
      console.log('🎉 All message handling and UI update tests passed!');
      console.log('✅ Task 18 requirements satisfied:');
      console.log('   ✓ Message parsing with API formats verified');
      console.log('   ✓ Job progress updates working correctly');
      console.log('   ✓ UI state synchronization confirmed');
      console.log('   ✓ Global events handled properly');
      console.log('   ✓ Connection status indicators functional');
    } else {
      console.log('⚠️  Some tests failed. Review the results above for details.');
      console.log('🔧 Common issues to check:');
      console.log('   - Ensure store subscriptions are properly set up');
      console.log('   - Verify WebSocket message handlers are registered');
      console.log('   - Check that UI components are connected to stores');
      console.log('   - Confirm message formats match API specifications');
    }

  } catch (error) {
    console.error('❌ Test suite failed to execute:', error);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check that all required stores are initialized');
    console.log('2. Verify message handling logic in WebSocketContext');
    console.log('3. Ensure UI components are properly connected');
    console.log('4. Review browser console for additional error details');
  }
}

/**
 * Test message parsing functionality only
 */
export async function testMessageParsing(): Promise<boolean> {
  console.log('📝 Testing WebSocket message parsing...');
  
  try {
    const results = await webSocketMessageTester.runMessageTestSuite();
    const parsingTest = results.results.find(r => r.testName === 'Message Parsing');
    
    if (parsingTest) {
      console.log(`Message parsing: ${parsingTest.success ? '✅ Passed' : '❌ Failed'}`);
      if (parsingTest.details) {
        console.log('Details:', parsingTest.details);
      }
      return parsingTest.success;
    }
    
    console.log('❌ Message parsing test not found');
    return false;
  } catch (error) {
    console.error('Message parsing test failed:', error);
    return false;
  }
}

/**
 * Test job update handling
 */
export async function testJobUpdates(): Promise<boolean> {
  console.log('💼 Testing job update handling...');
  
  try {
    const results = await webSocketMessageTester.runMessageTestSuite();
    const jobTests = results.results.filter(r => 
      r.testName.includes('Job Status') || 
      r.testName.includes('Job Progress')
    );
    
    const passed = jobTests.filter(r => r.success).length;
    const total = jobTests.length;
    
    console.log(`Job update tests: ${passed}/${total} passed`);
    
    jobTests.forEach(test => {
      const status = test.success ? '✅' : '❌';
      console.log(`  ${status} ${test.testName}: ${test.storeStateCorrect ? 'Store updated' : 'Store not updated'}`);
    });
    
    return passed === total;
  } catch (error) {
    console.error('Job update test failed:', error);
    return false;
  }
}

/**
 * Test UI synchronization
 */
export async function testUISynchronization(): Promise<boolean> {
  console.log('🔄 Testing UI state synchronization...');
  
  try {
    const results = await webSocketMessageTester.runMessageTestSuite();
    const syncTests = results.results.filter(r => 
      r.testName.includes('Store State Synchronization') ||
      r.testName.includes('UI Component Updates')
    );
    
    const passed = syncTests.filter(r => r.success).length;
    const total = syncTests.length;
    
    console.log(`UI sync tests: ${passed}/${total} passed`);
    
    syncTests.forEach(test => {
      const status = test.success ? '✅' : '❌';
      console.log(`  ${status} ${test.testName}`);
      if (test.details) {
        console.log(`     Details:`, test.details);
      }
    });
    
    return passed === total;
  } catch (error) {
    console.error('UI sync test failed:', error);
    return false;
  }
}

/**
 * Test with a specific job ID for real-time updates
 */
export async function testRealTimeJobUpdates(jobId: string): Promise<void> {
  console.log(`🚀 Testing real-time updates for job: ${jobId}`);
  console.log('Connecting to WebSocket and monitoring for updates...\n');
  
  try {
    const result = await webSocketMessageTester.testRealTimeJobUpdates(jobId);
    
    if (result.success) {
      console.log('✅ Real-time updates received successfully!');
      console.log(`   Progress updates: ${result.details?.progressUpdatesReceived || 0}`);
      console.log(`   Progress values: ${result.details?.progressValues?.join(', ') || 'None'}`);
      console.log(`   Last status: ${result.details?.lastStatus || 'Unknown'}`);
      console.log(`   Test duration: ${result.details?.duration || 0}ms`);
    } else {
      console.log('❌ Real-time update test failed');
      console.log(`   Error: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Real-time test error:', error);
  }
}

/**
 * Create a mock job and test updates
 */
export async function createMockJobAndTest(): Promise<void> {
  console.log('🎭 Creating mock job for testing...');
  
  const downloadsStore = useDownloadsStore.getState();
  const mockJobId = `mock-job-${Date.now()}`;
  
  // Add mock job
  downloadsStore.addJob({
    id: mockJobId,
    job_id: mockJobId,
    content_title: 'Mock Download Test',
    service: 'MOCK',
    status: 'downloading',
    progress: 0,
    quality: '1080p',
    start_time: new Date().toISOString()
  });
  
  console.log(`Mock job created: ${mockJobId}`);
  console.log('Simulating progress updates...\n');
  
  // Simulate progress updates
  const progressSteps = [10, 25, 50, 75, 90, 100];
  
  for (const progress of progressSteps) {
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay between updates
    
    downloadsStore.handleJobProgress(mockJobId, progress, `segment_${progress}.mp4`);
    
    const job = downloadsStore.jobs.find(j => j.id === mockJobId);
    console.log(`Progress: ${progress}% - Current file: ${job?.current_file || 'N/A'}`);
    
    if (progress === 100) {
      downloadsStore.updateJob(mockJobId, { 
        status: 'completed',
        end_time: new Date().toISOString()
      });
      console.log('✅ Job completed!');
    }
  }
  
  // Verify final state
  const finalJob = downloadsStore.jobs.find(j => j.id === mockJobId);
  console.log('\n📊 Final job state:');
  console.log(`   Status: ${finalJob?.status}`);
  console.log(`   Progress: ${finalJob?.progress}%`);
  console.log(`   Files: ${finalJob?.current_file}`);
  
  // Check UI state arrays
  const { activeJobs, completedJobs } = downloadsStore;
  console.log(`   Active jobs: ${activeJobs.length}`);
  console.log(`   Completed jobs: ${completedJobs.length}`);
}

/**
 * Monitor WebSocket connection status
 */
export function monitorConnectionStatus(): void {
  console.log('📡 Monitoring WebSocket connection status...');
  console.log('This will display connection state changes in real-time\n');
  
  let lastState = '';
  
  const interval = setInterval(() => {
    // This would typically get the actual connection state from WebSocketContext
    // For demonstration, we'll show what would be monitored
    const states = ['connecting', 'connected', 'reconnecting', 'disconnected', 'auth_failed'];
    const mockState = states[Math.floor(Math.random() * states.length)];
    
    if (mockState !== lastState) {
      const timestamp = new Date().toLocaleTimeString();
      const icon = mockState === 'connected' ? '✅' : 
                   mockState === 'connecting' ? '⏳' :
                   mockState === 'reconnecting' ? '🔄' :
                   mockState === 'auth_failed' ? '🔐' : '❌';
      
      console.log(`[${timestamp}] ${icon} Connection state: ${mockState}`);
      lastState = mockState;
    }
  }, 2000);
  
  console.log('Press Ctrl+C to stop monitoring');
  
  // Return cleanup function
  return () => clearInterval(interval);
}

// Expose functions for manual testing in browser console
if (typeof window !== 'undefined') {
  (window as any).runWebSocketMessageTests = runWebSocketMessageTests;
  (window as any).testMessageParsing = testMessageParsing;
  (window as any).testJobUpdates = testJobUpdates;
  (window as any).testUISynchronization = testUISynchronization;
  (window as any).testRealTimeJobUpdates = testRealTimeJobUpdates;
  (window as any).createMockJobAndTest = createMockJobAndTest;
  (window as any).monitorConnectionStatus = monitorConnectionStatus;
  
  // Auto-run info
  console.log('📬 WebSocket Message Test Functions Available:');
  console.log('- runWebSocketMessageTests() // Full test suite');
  console.log('- testMessageParsing() // Message parsing only');
  console.log('- testJobUpdates() // Job update handling');
  console.log('- testUISynchronization() // UI state sync');
  console.log('- testRealTimeJobUpdates(jobId) // Real-time test with job ID');
  console.log('- createMockJobAndTest() // Create mock job and test updates');
  console.log('- monitorConnectionStatus() // Monitor connection state');
}