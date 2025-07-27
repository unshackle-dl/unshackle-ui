import { useSearchStore } from './search-store';
import { useDownloadsStore } from './downloads-store';
import { useServicesStore } from './services-store';
import { useUIStore } from './ui-store';

interface StoreManager {
  // Store initialization
  initializeStores: () => void;
  
  // Cleanup and optimization
  cleanupExpiredData: () => void;
  optimizePerformance: () => void;
  
  // State hydration
  hydrateFromStorage: () => Promise<void>;
  
  // Dev tools
  getStoreSnapshot: () => Record<string, unknown>;
  resetAllStores: () => void;
}

class StoreManagerImpl implements StoreManager {
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  initializeStores() {
    // Initialize store subscriptions and listeners
    this.setupCleanupScheduler();
    this.setupPerformanceOptimizations();
    this.setupStoreSubscriptions();
  }

  private setupCleanupScheduler() {
    // Clean up expired data every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredData();
    }, 10 * 60 * 1000);
  }

  private setupPerformanceOptimizations() {
    // Set up performance monitoring
    if (typeof window !== 'undefined') {
      // Monitor memory usage
      const checkMemoryUsage = () => {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          const usedMB = memory.usedJSHeapSize / 1024 / 1024;
          
          // If memory usage is high, trigger cleanup
          if (usedMB > 100) {
            this.optimizePerformance();
          }
        }
      };

      // Check memory every 5 minutes
      setInterval(checkMemoryUsage, 5 * 60 * 1000);
    }
  }

  private setupStoreSubscriptions() {
    // Subscribe to download job updates to automatically update stats
    useDownloadsStore.subscribe(
      (state) => state.jobs,
      () => {
        useDownloadsStore.getState().updateStats();
      }
    );

    // Clean up expired search cache when search store changes
    useSearchStore.subscribe(
      (state) => state.cachedResults,
      () => {
        useSearchStore.getState().clearExpiredCache();
      }
    );
  }

  cleanupExpiredData() {
    // Clean up search cache
    useSearchStore.getState().clearExpiredCache();

    // Clean up old notifications
    const { notifications, removeNotification } = useUIStore.getState();
    const now = Date.now();
    notifications.forEach(notification => {
      if (now - notification.timestamp > 24 * 60 * 60 * 1000) { // 24 hours
        removeNotification(notification.id);
      }
    });
  }

  optimizePerformance() {
    // Limit search history size
    const searchStore = useSearchStore.getState();
    if (searchStore.searchHistory.length > 50) {
      const limitedHistory = searchStore.searchHistory.slice(0, 50);
      useSearchStore.setState({ searchHistory: limitedHistory });
    }

    // Limit download job history
    const downloadsStore = useDownloadsStore.getState();
    const oldJobs = downloadsStore.completedJobs.filter(
      job => Date.now() - new Date(job.end_time || job.start_time).getTime() > 7 * 24 * 60 * 60 * 1000 // 7 days
    );
    
    if (oldJobs.length > 0) {
      const newJobs = downloadsStore.jobs.filter(
        job => !oldJobs.some(oldJob => oldJob.id === job.id)
      );
      downloadsStore.setJobs(newJobs);
    }

    // Clear old performance metrics
    const servicesStore = useServicesStore.getState();
    Object.keys(servicesStore.performanceMetrics).forEach(serviceId => {
      const metrics = servicesStore.performanceMetrics[serviceId];
      if (Date.now() - metrics.lastSuccessfulRequest > 30 * 24 * 60 * 60 * 1000) { // 30 days
        servicesStore.resetServiceMetrics(serviceId);
      }
    });
  }

  async hydrateFromStorage() {
    // All stores with persist middleware will automatically hydrate
    // This method can be used for custom hydration logic if needed
    return Promise.resolve();
  }

  getStoreSnapshot() {
    return {
      search: useSearchStore.getState(),
      downloads: useDownloadsStore.getState(),
      services: useServicesStore.getState(),
      ui: useUIStore.getState(),
    };
  }

  resetAllStores() {
    // Reset all stores to initial state (useful for testing or logout)
    localStorage.removeItem('unshackle-search-store');
    localStorage.removeItem('unshackle-downloads-store');
    localStorage.removeItem('unshackle-services-store');
    localStorage.removeItem('unshackle-ui-store');
    
    // Force reload to reinitialize stores
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance
export const storeManager = new StoreManagerImpl();

// Auto-initialize in browser environment
if (typeof window !== 'undefined') {
  storeManager.initializeStores();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    storeManager.destroy();
  });
}

// React hook for accessing store manager
export function useStoreManager() {
  return storeManager;
}