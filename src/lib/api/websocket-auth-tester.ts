import { unshackleClient } from './index';
import { constructWebSocketURL, getJobWebSocketURL, getGlobalWebSocketURL } from '@/lib/utils';

export interface WebSocketTestResult {
  testName: string;
  success: boolean;
  description: string;
  errorCode?: number;
  errorMessage?: string;
  duration: number;
  details?: any;
}

export interface WebSocketAuthTestSuite {
  results: WebSocketTestResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageDuration: number;
  };
}

export class WebSocketAuthTester {
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:8888') {
    this.baseURL = baseURL;
  }

  /**
   * Run comprehensive authentication and error scenario tests
   */
  async runAuthTestSuite(): Promise<WebSocketAuthTestSuite> {
    const results: WebSocketTestResult[] = [];

    // Test 1: Valid authentication with 'devwork' token
    results.push(await this.testValidAuthentication());

    // Test 2: Missing token authentication
    results.push(await this.testMissingToken());

    // Test 3: Invalid token authentication  
    results.push(await this.testInvalidToken());

    // Test 4: Job not found error (4004)
    results.push(await this.testJobNotFound());

    // Test 5: Global events connection with valid auth
    results.push(await this.testGlobalEventsAuth());

    // Test 6: Global events connection with invalid auth
    results.push(await this.testGlobalEventsInvalidAuth());

    // Test 7: Reconnection after auth failure
    results.push(await this.testReconnectionAfterAuthFailure());

    // Test 8: URL construction correctness
    results.push(await this.testURLConstruction());

    const passedTests = results.filter(r => r.success).length;
    const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    return {
      results,
      summary: {
        totalTests: results.length,
        passedTests,
        failedTests: results.length - passedTests,
        averageDuration: Math.round(averageDuration),
      },
    };
  }

  /**
   * Test 1: Valid authentication with 'devwork' token
   */
  private async testValidAuthentication(): Promise<WebSocketTestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const testJobId = 'test-valid-auth-job';
      const wsURL = getJobWebSocketURL(this.baseURL, testJobId);
      const ws = new WebSocket(wsURL);
      
      let connected = false;
      let authError = false;
      
      const timeout = setTimeout(() => {
        if (!connected && !authError) {
          ws.close();
          resolve({
            testName: 'Valid Authentication',
            success: false,
            description: 'Test connection with correct devwork token',
            errorMessage: 'Connection timeout - no response from server',
            duration: Date.now() - startTime,
          });
        }
      }, 5000);

      ws.onopen = () => {
        connected = true;
        clearTimeout(timeout);
        ws.close();
        resolve({
          testName: 'Valid Authentication',
          success: true,
          description: 'Test connection with correct devwork token',
          duration: Date.now() - startTime,
          details: { wsURL, connected: true },
        });
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        resolve({
          testName: 'Valid Authentication',
          success: false,
          description: 'Test connection with correct devwork token',
          errorMessage: 'WebSocket connection error occurred',
          duration: Date.now() - startTime,
          details: { error, wsURL },
        });
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        if (event.code === 4001) {
          authError = true;
          resolve({
            testName: 'Valid Authentication',
            success: false,
            description: 'Test connection with correct devwork token',
            errorCode: event.code,
            errorMessage: 'Authentication failed with valid token - API configuration issue',
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason },
          });
        } else if (event.code === 4004) {
          // Job not found is expected for test job ID, but connection was authenticated
          resolve({
            testName: 'Valid Authentication',
            success: true,
            description: 'Test connection with correct devwork token',
            errorCode: event.code,
            errorMessage: 'Job not found (expected for test job ID)',
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason, authSuccess: true },
          });
        } else if (!connected) {
          resolve({
            testName: 'Valid Authentication',
            success: false,
            description: 'Test connection with correct devwork token',
            errorCode: event.code,
            errorMessage: `Connection closed unexpectedly: ${event.reason}`,
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason },
          });
        }
      };
    });
  }

  /**
   * Test 2: Missing token authentication
   */
  private async testMissingToken(): Promise<WebSocketTestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const testJobId = 'test-missing-token-job';
      const wsURL = `${this.baseURL.replace(/^http/, 'ws')}/api/v1/jobs/${testJobId}/events`; // No token
      const ws = new WebSocket(wsURL);
      
      const timeout = setTimeout(() => {
        ws.close();
        resolve({
          testName: 'Missing Token',
          success: false,
          description: 'Test connection without authentication token',
          errorMessage: 'Expected 4001 auth error but got timeout',
          duration: Date.now() - startTime,
        });
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          testName: 'Missing Token',
          success: false,
          description: 'Test connection without authentication token',
          errorMessage: 'Connection succeeded when it should have failed due to missing token',
          duration: Date.now() - startTime,
          details: { wsURL, unexpectedSuccess: true },
        });
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        if (event.code === 4001) {
          resolve({
            testName: 'Missing Token',
            success: true,
            description: 'Test connection without authentication token',
            errorCode: event.code,
            errorMessage: 'Authentication failed as expected (missing token)',
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason },
          });
        } else {
          resolve({
            testName: 'Missing Token',
            success: false,
            description: 'Test connection without authentication token',
            errorCode: event.code,
            errorMessage: `Expected 4001 auth error but got ${event.code}: ${event.reason}`,
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason },
          });
        }
      };

      ws.onerror = () => {
        // Error is expected, we'll handle it in onclose
      };
    });
  }

  /**
   * Test 3: Invalid token authentication
   */
  private async testInvalidToken(): Promise<WebSocketTestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const testJobId = 'test-invalid-token-job';
      const wsURL = constructWebSocketURL(this.baseURL, `/api/v1/jobs/${testJobId}/events`, 'invalid-token');
      const ws = new WebSocket(wsURL);
      
      const timeout = setTimeout(() => {
        ws.close();
        resolve({
          testName: 'Invalid Token',
          success: false,
          description: 'Test connection with incorrect authentication token',
          errorMessage: 'Expected 4001 auth error but got timeout',
          duration: Date.now() - startTime,
        });
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          testName: 'Invalid Token',
          success: false,
          description: 'Test connection with incorrect authentication token',
          errorMessage: 'Connection succeeded when it should have failed due to invalid token',
          duration: Date.now() - startTime,
          details: { wsURL, unexpectedSuccess: true },
        });
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        if (event.code === 4001) {
          resolve({
            testName: 'Invalid Token',
            success: true,
            description: 'Test connection with incorrect authentication token',
            errorCode: event.code,
            errorMessage: 'Authentication failed as expected (invalid token)',
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason },
          });
        } else {
          resolve({
            testName: 'Invalid Token',
            success: false,
            description: 'Test connection with incorrect authentication token',
            errorCode: event.code,
            errorMessage: `Expected 4001 auth error but got ${event.code}: ${event.reason}`,
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason },
          });
        }
      };

      ws.onerror = () => {
        // Error is expected, we'll handle it in onclose
      };
    });
  }

  /**
   * Test 4: Job not found error (4004)
   */
  private async testJobNotFound(): Promise<WebSocketTestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const nonExistentJobId = 'non-existent-job-12345';
      const wsURL = getJobWebSocketURL(this.baseURL, nonExistentJobId);
      const ws = new WebSocket(wsURL);
      
      const timeout = setTimeout(() => {
        ws.close();
        resolve({
          testName: 'Job Not Found',
          success: false,
          description: 'Test connection to non-existent job ID',
          errorMessage: 'Expected 4004 job not found error but got timeout',
          duration: Date.now() - startTime,
        });
      }, 5000);

      ws.onopen = () => {
        // Connection opened, but should close immediately with 4004
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        if (event.code === 4004) {
          resolve({
            testName: 'Job Not Found',
            success: true,
            description: 'Test connection to non-existent job ID',
            errorCode: event.code,
            errorMessage: 'Job not found error returned as expected',
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason },
          });
        } else if (event.code === 4001) {
          resolve({
            testName: 'Job Not Found',
            success: false,
            description: 'Test connection to non-existent job ID',
            errorCode: event.code,
            errorMessage: 'Got auth error instead of job not found - possible auth issue',
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason },
          });
        } else {
          resolve({
            testName: 'Job Not Found',
            success: false,
            description: 'Test connection to non-existent job ID',
            errorCode: event.code,
            errorMessage: `Expected 4004 job not found error but got ${event.code}: ${event.reason}`,
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason },
          });
        }
      };

      ws.onerror = () => {
        // Error is expected, we'll handle it in onclose
      };
    });
  }

  /**
   * Test 5: Global events connection with valid auth
   */
  private async testGlobalEventsAuth(): Promise<WebSocketTestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const wsURL = getGlobalWebSocketURL(this.baseURL);
      const ws = new WebSocket(wsURL);
      
      let connected = false;
      
      const timeout = setTimeout(() => {
        if (!connected) {
          ws.close();
          resolve({
            testName: 'Global Events Auth',
            success: false,
            description: 'Test global events connection with valid auth',
            errorMessage: 'Connection timeout - no response from server',
            duration: Date.now() - startTime,
          });
        }
      }, 5000);

      ws.onopen = () => {
        connected = true;
        clearTimeout(timeout);
        
        // Send a ping to test the connection
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        
        setTimeout(() => {
          ws.close();
          resolve({
            testName: 'Global Events Auth',
            success: true,
            description: 'Test global events connection with valid auth',
            duration: Date.now() - startTime,
            details: { wsURL, connected: true },
          });
        }, 1000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Global events message received:', message);
        } catch (error) {
          console.error('Failed to parse global events message:', error);
        }
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        if (event.code === 4001) {
          resolve({
            testName: 'Global Events Auth',
            success: false,
            description: 'Test global events connection with valid auth',
            errorCode: event.code,
            errorMessage: 'Authentication failed for global events',
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason },
          });
        } else if (!connected) {
          resolve({
            testName: 'Global Events Auth',
            success: false,
            description: 'Test global events connection with valid auth',
            errorCode: event.code,
            errorMessage: `Connection failed: ${event.reason}`,
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason },
          });
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        resolve({
          testName: 'Global Events Auth',
          success: false,
          description: 'Test global events connection with valid auth',
          errorMessage: 'WebSocket connection error occurred',
          duration: Date.now() - startTime,
          details: { error, wsURL },
        });
      };
    });
  }

  /**
   * Test 6: Global events connection with invalid auth
   */
  private async testGlobalEventsInvalidAuth(): Promise<WebSocketTestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const wsURL = constructWebSocketURL(this.baseURL, '/api/v1/events', 'invalid-token');
      const ws = new WebSocket(wsURL);
      
      const timeout = setTimeout(() => {
        ws.close();
        resolve({
          testName: 'Global Events Invalid Auth',
          success: false,
          description: 'Test global events connection with invalid auth',
          errorMessage: 'Expected 4001 auth error but got timeout',
          duration: Date.now() - startTime,
        });
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve({
          testName: 'Global Events Invalid Auth',
          success: false,
          description: 'Test global events connection with invalid auth',
          errorMessage: 'Connection succeeded when it should have failed due to invalid token',
          duration: Date.now() - startTime,
          details: { wsURL, unexpectedSuccess: true },
        });
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        if (event.code === 4001) {
          resolve({
            testName: 'Global Events Invalid Auth',
            success: true,
            description: 'Test global events connection with invalid auth',
            errorCode: event.code,
            errorMessage: 'Authentication failed as expected (invalid token)',
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason },
          });
        } else {
          resolve({
            testName: 'Global Events Invalid Auth',
            success: false,
            description: 'Test global events connection with invalid auth',
            errorCode: event.code,
            errorMessage: `Expected 4001 auth error but got ${event.code}: ${event.reason}`,
            duration: Date.now() - startTime,
            details: { closeCode: event.code, reason: event.reason },
          });
        }
      };

      ws.onerror = () => {
        // Error is expected, we'll handle it in onclose
      };
    });
  }

  /**
   * Test 7: Reconnection after auth failure
   */
  private async testReconnectionAfterAuthFailure(): Promise<WebSocketTestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let attemptCount = 0;
      let authFailureDetected = false;
      let reconnectionAttempted = false;
      
      const attemptConnection = (token: string, isRetry: boolean = false) => {
        const testJobId = 'test-reconnection-job';
        const wsURL = constructWebSocketURL(this.baseURL, `/api/v1/jobs/${testJobId}/events`, token);
        const ws = new WebSocket(wsURL);
        
        attemptCount++;
        
        ws.onopen = () => {
          if (isRetry) {
            ws.close();
            resolve({
              testName: 'Reconnection After Auth Failure',
              success: true,
              description: 'Test reconnection behavior after authentication failure',
              duration: Date.now() - startTime,
              details: { 
                attempts: attemptCount, 
                authFailureDetected, 
                reconnectionSuccessful: true 
              },
            });
          }
        };

        ws.onclose = (event) => {
          if (event.code === 4001 && !isRetry) {
            authFailureDetected = true;
            reconnectionAttempted = true;
            
            // Simulate reconnection with correct token after auth failure
            setTimeout(() => {
              attemptConnection('devwork', true);
            }, 1000);
            
          } else if (event.code === 4001 && isRetry) {
            resolve({
              testName: 'Reconnection After Auth Failure',
              success: false,
              description: 'Test reconnection behavior after authentication failure',
              errorCode: event.code,
              errorMessage: 'Reconnection with correct token still failed',
              duration: Date.now() - startTime,
              details: { attempts: attemptCount, authFailureDetected },
            });
            
          } else if (event.code === 4004 && isRetry) {
            // Job not found after successful auth = success
            resolve({
              testName: 'Reconnection After Auth Failure',
              success: true,
              description: 'Test reconnection behavior after authentication failure',
              duration: Date.now() - startTime,
              details: { 
                attempts: attemptCount, 
                authFailureDetected, 
                reconnectionSuccessful: true,
                finalError: 'Job not found (expected)'
              },
            });
          }
        };

        ws.onerror = () => {
          // Handle in onclose
        };
      };

      // Start with invalid token to trigger auth failure
      attemptConnection('invalid-token');
      
      // Timeout for the entire test
      setTimeout(() => {
        if (!reconnectionAttempted) {
          resolve({
            testName: 'Reconnection After Auth Failure',
            success: false,
            description: 'Test reconnection behavior after authentication failure',
            errorMessage: 'Test timed out before reconnection could be attempted',
            duration: Date.now() - startTime,
            details: { attempts: attemptCount, authFailureDetected },
          });
        }
      }, 10000);
    });
  }

  /**
   * Test 8: URL construction correctness
   */
  private async testURLConstruction(): Promise<WebSocketTestResult> {
    const startTime = Date.now();
    
    try {
      const testCases = [
        {
          baseURL: 'http://localhost:8888',
          expected: {
            job: 'ws://localhost:8888/api/v1/jobs/test-job/events?token=devwork',
            global: 'ws://localhost:8888/api/v1/events?token=devwork'
          }
        },
        {
          baseURL: 'https://api.example.com',
          expected: {
            job: 'wss://api.example.com/api/v1/jobs/test-job/events?token=devwork',
            global: 'wss://api.example.com/api/v1/events?token=devwork'
          }
        },
        {
          baseURL: 'http://192.168.1.100:9999',
          expected: {
            job: 'ws://192.168.1.100:9999/api/v1/jobs/test-job/events?token=devwork',
            global: 'ws://192.168.1.100:9999/api/v1/events?token=devwork'
          }
        }
      ];

      const results = [];
      
      for (const testCase of testCases) {
        const jobURL = getJobWebSocketURL(testCase.baseURL, 'test-job');
        const globalURL = getGlobalWebSocketURL(testCase.baseURL);
        
        const jobMatch = jobURL === testCase.expected.job;
        const globalMatch = globalURL === testCase.expected.global;
        
        results.push({
          baseURL: testCase.baseURL,
          jobURL: { actual: jobURL, expected: testCase.expected.job, match: jobMatch },
          globalURL: { actual: globalURL, expected: testCase.expected.global, match: globalMatch },
          success: jobMatch && globalMatch
        });
      }

      const allPassed = results.every(r => r.success);
      
      return {
        testName: 'URL Construction',
        success: allPassed,
        description: 'Test WebSocket URL construction for various base URLs',
        duration: Date.now() - startTime,
        details: { testCases: results },
      };
      
    } catch (error) {
      return {
        testName: 'URL Construction',
        success: false,
        description: 'Test WebSocket URL construction for various base URLs',
        errorMessage: error instanceof Error ? error.message : 'Unknown error during URL construction',
        duration: Date.now() - startTime,
        details: { error },
      };
    }
  }

  /**
   * Test WebSocket with API client methods
   */
  async testUnshackleClientWebSocketMethods(): Promise<WebSocketTestResult[]> {
    const results: WebSocketTestResult[] = [];
    
    // Test job events connection
    const jobTestResult = await new Promise<WebSocketTestResult>((resolve) => {
      const startTime = Date.now();
      let connected = false;
      let authError = false;
      
      const timeout = setTimeout(() => {
        resolve({
          testName: 'UnshackleClient Job Events',
          success: false,
          description: 'Test UnshackleClient.connectToJobEvents method',
          errorMessage: 'Connection timeout',
          duration: Date.now() - startTime,
        });
      }, 5000);

      unshackleClient.connectToJobEvents(
        'test-client-job',
        (message) => {
          console.log('Received message via client:', message);
        },
        () => {
          connected = true;
          clearTimeout(timeout);
          unshackleClient.disconnectWebSocket();
          resolve({
            testName: 'UnshackleClient Job Events',
            success: true,
            description: 'Test UnshackleClient.connectToJobEvents method',
            duration: Date.now() - startTime,
            details: { connected: true },
          });
        },
        () => {
          clearTimeout(timeout);
          if (!authError && !connected) {
            resolve({
              testName: 'UnshackleClient Job Events',
              success: false,
              description: 'Test UnshackleClient.connectToJobEvents method',
              errorMessage: 'Connection closed without auth error or successful connection',
              duration: Date.now() - startTime,
            });
          }
        },
        () => {
          authError = true;
          clearTimeout(timeout);
          resolve({
            testName: 'UnshackleClient Job Events',
            success: false,
            description: 'Test UnshackleClient.connectToJobEvents method',
            errorMessage: 'Authentication failed via client method',
            duration: Date.now() - startTime,
            details: { authError: true },
          });
        },
        () => {
          clearTimeout(timeout);
          resolve({
            testName: 'UnshackleClient Job Events',
            success: true,
            description: 'Test UnshackleClient.connectToJobEvents method',
            errorMessage: 'Job not found (expected for test job)',
            duration: Date.now() - startTime,
            details: { jobNotFound: true },
          });
        }
      );
    });
    
    results.push(jobTestResult);

    // Test global events connection
    const globalTestResult = await new Promise<WebSocketTestResult>((resolve) => {
      const startTime = Date.now();
      let connected = false;
      let authError = false;
      
      const timeout = setTimeout(() => {
        resolve({
          testName: 'UnshackleClient Global Events',
          success: false,
          description: 'Test UnshackleClient.connectToGlobalEvents method',
          errorMessage: 'Connection timeout',
          duration: Date.now() - startTime,
        });
      }, 5000);

      unshackleClient.connectToGlobalEvents(
        (message) => {
          console.log('Received global message via client:', message);
        },
        () => {
          connected = true;
          clearTimeout(timeout);
          
          // Test sending a message
          setTimeout(() => {
            unshackleClient.disconnectWebSocket();
            resolve({
              testName: 'UnshackleClient Global Events',
              success: true,
              description: 'Test UnshackleClient.connectToGlobalEvents method',
              duration: Date.now() - startTime,
              details: { connected: true },
            });
          }, 1000);
        },
        () => {
          clearTimeout(timeout);
          if (!authError && !connected) {
            resolve({
              testName: 'UnshackleClient Global Events',
              success: false,
              description: 'Test UnshackleClient.connectToGlobalEvents method',
              errorMessage: 'Connection closed without auth error or successful connection',
              duration: Date.now() - startTime,
            });
          }
        },
        () => {
          authError = true;
          clearTimeout(timeout);
          resolve({
            testName: 'UnshackleClient Global Events',
            success: false,
            description: 'Test UnshackleClient.connectToGlobalEvents method',
            errorMessage: 'Authentication failed via client method',
            duration: Date.now() - startTime,
            details: { authError: true },
          });
        }
      );
    });
    
    results.push(globalTestResult);
    
    return results;
  }
}

export const webSocketAuthTester = new WebSocketAuthTester();

// Expose for dev tools and manual testing
if (typeof window !== 'undefined') {
  (window as any).webSocketAuthTester = webSocketAuthTester;
  (window as any).testWebSocketAuth = () => webSocketAuthTester.runAuthTestSuite().then(console.table);
  (window as any).testWSClientMethods = () => webSocketAuthTester.testUnshackleClientWebSocketMethods().then(console.table);
}