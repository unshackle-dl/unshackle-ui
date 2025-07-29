import { webSocketAuthTester, type WebSocketAuthTestSuite } from './websocket-auth-tester';
import { unshackleClient } from './index';

/**
 * Main test runner for WebSocket authentication and error scenarios
 * Run this to execute Task 17: Test authentication and error scenarios
 */
export async function runWebSocketAuthTests(): Promise<void> {
  console.log('🧪 Starting WebSocket Authentication and Error Scenario Tests...\n');
  console.log('This test suite validates:');
  console.log('- Authentication with correct "devwork" token');
  console.log('- Behavior with missing or incorrect tokens');
  console.log('- 4001 (auth error) and 4004 (job not found) error handling');
  console.log('- Reconnection behavior after authentication failures\n');

  try {
    // Set the base URL for testing
    const baseURL = unshackleClient.baseURL || 'http://localhost:8888';
    console.log(`🔗 Testing against API server: ${baseURL}`);
    console.log('📝 Note: API server should be running at localhost:8888 for these tests\n');

    // Run the comprehensive auth test suite
    const results: WebSocketAuthTestSuite = await webSocketAuthTester.runAuthTestSuite();
    
    // Display results
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('========================');
    console.log(`Total Tests: ${results.summary.totalTests}`);
    console.log(`✅ Passed: ${results.summary.passedTests}`);
    console.log(`❌ Failed: ${results.summary.failedTests}`);
    console.log(`⏱️  Average Duration: ${results.summary.averageDuration}ms\n`);

    // Display individual test results
    console.log('📋 DETAILED TEST RESULTS');
    console.log('=========================');
    
    results.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      
      console.log(`${index + 1}. ${status} ${result.testName} (${duration})`);
      console.log(`   Description: ${result.description}`);
      
      if (result.errorCode) {
        console.log(`   Error Code: ${result.errorCode}`);
      }
      
      if (result.errorMessage) {
        console.log(`   Message: ${result.errorMessage}`);
      }
      
      if (result.details) {
        console.log(`   Details:`, result.details);
      }
      
      console.log(''); // Empty line for readability
    });

    // Test UnshackleClient WebSocket methods
    console.log('🔌 TESTING UNSHACKLE CLIENT WEBSOCKET METHODS');
    console.log('==============================================');
    
    const clientMethodResults = await webSocketAuthTester.testUnshackleClientWebSocketMethods();
    
    clientMethodResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      
      console.log(`${index + 1}. ${status} ${result.testName} (${duration})`);
      console.log(`   Description: ${result.description}`);
      
      if (result.errorMessage) {
        console.log(`   Message: ${result.errorMessage}`);
      }
      
      if (result.details) {
        console.log(`   Details:`, result.details);
      }
      
      console.log(''); // Empty line for readability
    });

    // Final summary
    const allResults = [...results.results, ...clientMethodResults];
    const totalPassed = allResults.filter(r => r.success).length;
    const totalTests = allResults.length;
    
    console.log('🎯 FINAL SUMMARY');
    console.log('================');
    console.log(`Overall Success Rate: ${Math.round((totalPassed / totalTests) * 100)}% (${totalPassed}/${totalTests})`);
    
    if (totalPassed === totalTests) {
      console.log('🎉 All WebSocket authentication and error handling tests passed!');
      console.log('✅ Task 17 requirements satisfied:');
      console.log('   ✓ Authentication with devwork token validated');
      console.log('   ✓ Missing/incorrect token error handling verified');
      console.log('   ✓ 4001 and 4004 error codes properly handled');
      console.log('   ✓ Reconnection behavior after auth failures tested');
    } else {
      console.log('⚠️  Some tests failed. Review the results above for details.');
      console.log('🔧 Common issues to check:');
      console.log('   - Is the Unshackle API server running at localhost:8888?');
      console.log('   - Is the API server configured with devwork authentication?');
      console.log('   - Are WebSocket endpoints properly implemented in the API?');
      console.log('   - Check network connectivity and firewall settings');
    }

  } catch (error) {
    console.error('❌ Test suite failed to execute:', error);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Ensure the Unshackle API server is running');
    console.log('2. Check that WebSocket endpoints are available');
    console.log('3. Verify authentication configuration in the API');
    console.log('4. Review browser console for additional error details');
  }
}

/**
 * Quick test for basic authentication functionality
 */
export async function quickAuthTest(): Promise<boolean> {
  console.log('🚀 Running quick WebSocket authentication test...');
  
  try {
    const results = await webSocketAuthTester.runAuthTestSuite();
    const authTests = results.results.filter(r => 
      r.testName.includes('Valid Authentication') || 
      r.testName.includes('Invalid Token') ||
      r.testName.includes('Missing Token')
    );
    
    const passed = authTests.filter(r => r.success).length;
    const total = authTests.length;
    
    console.log(`Authentication tests: ${passed}/${total} passed`);
    
    return passed === total;
  } catch (error) {
    console.error('Quick auth test failed:', error);
    return false;
  }
}

/**
 * Test only error code handling (4001, 4004)
 */
export async function testErrorCodes(): Promise<boolean> {
  console.log('🔍 Testing WebSocket error code handling...');
  
  try {
    const results = await webSocketAuthTester.runAuthTestSuite();
    const errorTests = results.results.filter(r => 
      r.testName.includes('Invalid Token') ||
      r.testName.includes('Missing Token') ||
      r.testName.includes('Job Not Found')
    );
    
    const passed = errorTests.filter(r => r.success).length;
    const total = errorTests.length;
    
    console.log(`Error code tests: ${passed}/${total} passed`);
    
    errorTests.forEach(test => {
      const status = test.success ? '✅' : '❌';
      console.log(`  ${status} ${test.testName}: ${test.errorCode || 'No error code'}`);
    });
    
    return passed === total;
  } catch (error) {
    console.error('Error code test failed:', error);
    return false;
  }
}

/**
 * Test reconnection behavior specifically
 */
export async function testReconnectionBehavior(): Promise<boolean> {
  console.log('🔄 Testing WebSocket reconnection behavior...');
  
  try {
    const results = await webSocketAuthTester.runAuthTestSuite();
    const reconnectionTest = results.results.find(r => 
      r.testName.includes('Reconnection After Auth Failure')
    );
    
    if (reconnectionTest) {
      const status = reconnectionTest.success ? '✅' : '❌';
      console.log(`${status} Reconnection test: ${reconnectionTest.errorMessage || 'Passed'}`);
      
      if (reconnectionTest.details) {
        console.log('  Details:', reconnectionTest.details);
      }
      
      return reconnectionTest.success;
    } else {
      console.log('❌ Reconnection test not found in results');
      return false;
    }
  } catch (error) {
    console.error('Reconnection test failed:', error);
    return false;
  }
}

// Expose functions for manual testing in browser console
if (typeof window !== 'undefined') {
  (window as any).runWebSocketAuthTests = runWebSocketAuthTests;
  (window as any).quickAuthTest = quickAuthTest;
  (window as any).testErrorCodes = testErrorCodes;
  (window as any).testReconnectionBehavior = testReconnectionBehavior;
  
  // Auto-run info
  console.log('🔧 WebSocket Auth Test Functions Available:');
  console.log('- runWebSocketAuthTests() // Full test suite');
  console.log('- quickAuthTest() // Basic auth test');
  console.log('- testErrorCodes() // Error handling test');
  console.log('- testReconnectionBehavior() // Reconnection test');
}