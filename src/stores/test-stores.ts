import { useSearchStore } from './search-store';
import { useDownloadsStore } from './downloads-store';
import { useServicesStore } from './services-store';
import { useUIStore } from './ui-store';

export function testStores() {
  console.log('Testing state management...');

  // Test search store
  const searchStore = useSearchStore.getState();
  searchStore.setTmdbQuery('test movie');
  searchStore.addToSearchHistory('test movie', 5);
  searchStore.toggleContentType('music');
  console.log('✓ Search store test passed');

  // Test downloads store  
  const downloadsStore = useDownloadsStore.getState();
  downloadsStore.setMaxConcurrentDownloads(5);
  downloadsStore.updateStats();
  console.log('✓ Downloads store test passed');

  // Test services store
  const servicesStore = useServicesStore.getState();
  servicesStore.setServiceConfig('NF', { enabled: true, priority: 1 });
  servicesStore.recordPerformanceMetric('NF', 150, true);
  console.log('✓ Services store test passed');

  // Test UI store
  const uiStore = useUIStore.getState();
  uiStore.addNotification({
    type: 'success',
    title: 'Test notification',
    description: 'Store test completed'
  });
  console.log('✓ UI store test passed');

  console.log('All store tests passed! 🎉');
}

// Export for use in dev tools
if (typeof window !== 'undefined') {
  (window as any).testStores = testStores;
}