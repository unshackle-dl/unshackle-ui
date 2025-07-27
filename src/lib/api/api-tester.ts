import { apiClientManager } from './api-client-manager';
import { APIError, APIErrorType } from './api-errors';

export interface APITestResult {
  service: string;
  endpoint: string;
  success: boolean;
  responseTime: number;
  error?: string;
  data?: unknown;
}

export interface APITestSuite {
  unshackle: APITestResult[];
  tmdb: APITestResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageResponseTime: number;
  };
}

export class APITester {
  async runFullTestSuite(): Promise<APITestSuite> {
    const unshackleTests = await this.testUnshackleAPI();
    const tmdbTests = await this.testTMDBAPI();

    const allTests = [...unshackleTests, ...tmdbTests];
    const passedTests = allTests.filter(test => test.success).length;
    const averageResponseTime = allTests.reduce((sum, test) => sum + test.responseTime, 0) / allTests.length;

    return {
      unshackle: unshackleTests,
      tmdb: tmdbTests,
      summary: {
        totalTests: allTests.length,
        passedTests,
        failedTests: allTests.length - passedTests,
        averageResponseTime: Math.round(averageResponseTime),
      },
    };
  }

  private async testUnshackleAPI(): Promise<APITestResult[]> {
    const tests: APITestResult[] = [];

    try {
      const client = apiClientManager.getUnshackleClient();

      // Test 1: Get Services
      tests.push(await this.runTest('unshackle', 'GET /api/services', async () => {
        return await client.getServices();
      }));

      // Test 2: Get Jobs
      tests.push(await this.runTest('unshackle', 'GET /api/jobs', async () => {
        return await client.getAllJobs();
      }));

      // Test 3: Search (if services are available)
      const services = await client.getServices().catch(() => []);
      if (services.length > 0) {
        tests.push(await this.runTest('unshackle', 'POST /api/search', async () => {
          return await client.search({
            service: services[0].id,
            query: 'test',
            type: 'movie',
          });
        }));
      } else {
        tests.push({
          service: 'unshackle',
          endpoint: 'POST /api/search',
          success: false,
          responseTime: 0,
          error: 'No services available for testing',
        });
      }

    } catch (error) {
      // If client is not available, mark all tests as failed
      const clientError = error instanceof APIError ? error.getUserMessage() : 'Client not available';
      
      tests.push(
        ...[
          'GET /api/services',
          'GET /api/jobs',
          'POST /api/search',
        ].map(endpoint => ({
          service: 'unshackle',
          endpoint,
          success: false,
          responseTime: 0,
          error: clientError,
        }))
      );
    }

    return tests;
  }

  private async testTMDBAPI(): Promise<APITestResult[]> {
    const tests: APITestResult[] = [];

    try {
      const client = apiClientManager.getTMDBClient();

      // Test 1: Multi Search
      tests.push(await this.runTest('tmdb', 'GET /search/multi', async () => {
        return await client.searchMulti('avengers', 1);
      }));

      // Test 2: Search Movies
      tests.push(await this.runTest('tmdb', 'GET /search/movie', async () => {
        return await client.searchMovies('inception', 1);
      }));

      // Test 3: Search TV
      tests.push(await this.runTest('tmdb', 'GET /search/tv', async () => {
        return await client.searchTV('breaking bad', 1);
      }));

      // Test 4: Get Trending
      tests.push(await this.runTest('tmdb', 'GET /trending/all/week', async () => {
        return await client.getTrending('all', 'week');
      }));

    } catch (error) {
      // If client is not available, mark all tests as failed
      const clientError = error instanceof APIError ? error.getUserMessage() : 'Client not available';
      
      tests.push(
        ...[
          'GET /search/multi',
          'GET /search/movie',
          'GET /search/tv',
          'GET /trending/all/week',
        ].map(endpoint => ({
          service: 'tmdb',
          endpoint,
          success: false,
          responseTime: 0,
          error: clientError,
        }))
      );
    }

    return tests;
  }

  private async runTest(
    service: string,
    endpoint: string,
    testFn: () => Promise<unknown>
  ): Promise<APITestResult> {
    const startTime = Date.now();

    try {
      const data = await testFn();
      const responseTime = Date.now() - startTime;

      return {
        service,
        endpoint,
        success: true,
        responseTime,
        data: Array.isArray(data) ? `Array(${data.length})` : typeof data,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof APIError 
        ? error.getUserMessage() 
        : error instanceof Error 
        ? error.message 
        : 'Unknown error';

      return {
        service,
        endpoint,
        success: false,
        responseTime,
        error: errorMessage,
      };
    }
  }

  async testConnection(service: 'unshackle' | 'tmdb'): Promise<boolean> {
    try {
      if (service === 'unshackle') {
        const client = apiClientManager.getUnshackleClient();
        await client.getServices();
      } else {
        const client = apiClientManager.getTMDBClient();
        await client.searchMulti('test', 1);
      }
      return true;
    } catch {
      return false;
    }
  }

  async testAuthentication(service: 'unshackle' | 'tmdb'): Promise<{ success: boolean; error?: string }> {
    try {
      if (service === 'unshackle') {
        const client = apiClientManager.getUnshackleClient();
        await client.getServices();
      } else {
        const client = apiClientManager.getTMDBClient();
        await client.searchMulti('test', 1);
      }
      
      return { success: true };
    } catch (error) {
      if (error instanceof APIError && error.type === APIErrorType.AUTHENTICATION_ERROR) {
        return { 
          success: false, 
          error: 'Authentication failed. Please check your API key.' 
        };
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export const apiTester = new APITester();

// Expose for dev tools
if (typeof window !== 'undefined') {
  (window as any).apiTester = apiTester;
  (window as any).testAPIs = () => apiTester.runFullTestSuite().then(console.table);
}