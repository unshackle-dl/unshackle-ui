import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { type ServiceInfo } from '@/lib/types';

interface ServicesState {
  // Services Data
  services: ServiceInfo[];
  loading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Service Health Monitoring
  healthChecks: Record<string, {
    status: 'healthy' | 'degraded' | 'down';
    lastCheck: number;
    responseTime?: number;
  }>;

  // Authentication Status
  authStatus: Record<string, {
    status: 'authenticated' | 'unauthenticated' | 'expired' | 'pending';
    lastCheck: number;
    expiresAt?: number;
  }>;

  // Preferences
  preferredServices: string[];
  hiddenServices: string[];

  // Service Configuration
  serviceConfigs: Record<string, {
    enabled: boolean;
    priority: number;
    customSettings?: Record<string, unknown>;
  }>;

  // Performance Monitoring
  performanceMetrics: Record<string, {
    averageResponseTime: number;
    successRate: number;
    lastSuccessfulRequest: number;
    errorCount: number;
    totalRequests: number;
  }>;

  // Cache Management
  cacheSettings: {
    servicesListTTL: number;
    healthCheckTTL: number;
    authStatusTTL: number;
  };

  // Actions
  setServices: (services: ServiceInfo[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateService: (serviceId: string, updates: Partial<ServiceInfo>) => void;
  updateServiceStatus: (serviceId: string, status: ServiceInfo['status']) => void;
  
  setHealthCheck: (serviceId: string, health: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime?: number;
  }) => void;
  
  setAuthStatus: (serviceId: string, auth: {
    status: 'authenticated' | 'unauthenticated' | 'expired' | 'pending';
    expiresAt?: number;
  }) => void;
  
  addPreferredService: (serviceId: string) => void;
  removePreferredService: (serviceId: string) => void;
  setPreferredServices: (services: string[]) => void;
  
  hideService: (serviceId: string) => void;
  showService: (serviceId: string) => void;
  
  getAvailableServices: () => ServiceInfo[];
  getServiceById: (serviceId: string) => ServiceInfo | undefined;
  needsRefresh: () => boolean;

  // Enhanced actions
  setServiceConfig: (serviceId: string, config: Partial<ServicesState['serviceConfigs'][string]>) => void;
  getServiceConfig: (serviceId: string) => ServicesState['serviceConfigs'][string] | undefined;
  
  recordPerformanceMetric: (serviceId: string, responseTime: number, success: boolean) => void;
  getServiceMetrics: (serviceId: string) => ServicesState['performanceMetrics'][string] | undefined;
  resetServiceMetrics: (serviceId: string) => void;
  
  setCacheSettings: (settings: Partial<ServicesState['cacheSettings']>) => void;
  isHealthCheckExpired: (serviceId: string) => boolean;
  isAuthStatusExpired: (serviceId: string) => boolean;
  
  bulkUpdateServiceStatus: (updates: Array<{ serviceId: string; status: ServiceInfo['status'] }>) => void;
  reorderPreferredServices: (fromIndex: number, toIndex: number) => void;
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const useServicesStore = create<ServicesState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        services: [],
        loading: false,
        error: null,
        lastFetched: null,

        healthChecks: {},
        authStatus: {},

        preferredServices: ['NF', 'DSNP', 'AMZN'], // Default preferred services
        hiddenServices: [],

        // New state
        serviceConfigs: {},
        performanceMetrics: {},
        cacheSettings: {
          servicesListTTL: REFRESH_INTERVAL,
          healthCheckTTL: 2 * 60 * 1000, // 2 minutes
          authStatusTTL: 30 * 60 * 1000, // 30 minutes
        },

    // Actions
    setServices: (services) => set({ 
      services, 
      lastFetched: Date.now(),
      error: null 
    }),

    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),

    updateService: (serviceId, updates) => {
      const { services } = get();
      const newServices = services.map(service =>
        service.id === serviceId ? { ...service, ...updates } : service
      );
      set({ services: newServices });
    },

    updateServiceStatus: (serviceId, status) => {
      get().updateService(serviceId, { status });
    },

    setHealthCheck: (serviceId, health) => set((state) => ({
      healthChecks: {
        ...state.healthChecks,
        [serviceId]: {
          ...health,
          lastCheck: Date.now(),
        },
      },
    })),

    setAuthStatus: (serviceId, auth) => set((state) => ({
      authStatus: {
        ...state.authStatus,
        [serviceId]: {
          ...auth,
          lastCheck: Date.now(),
        },
      },
    })),

    addPreferredService: (serviceId) => {
      const { preferredServices } = get();
      if (!preferredServices.includes(serviceId)) {
        set({ preferredServices: [...preferredServices, serviceId] });
      }
    },

    removePreferredService: (serviceId) => {
      const { preferredServices } = get();
      set({ preferredServices: preferredServices.filter(id => id !== serviceId) });
    },

    setPreferredServices: (services) => set({ preferredServices: services }),

    hideService: (serviceId) => {
      const { hiddenServices } = get();
      if (!hiddenServices.includes(serviceId)) {
        set({ hiddenServices: [...hiddenServices, serviceId] });
      }
    },

    showService: (serviceId) => {
      const { hiddenServices } = get();
      set({ hiddenServices: hiddenServices.filter(id => id !== serviceId) });
    },

    getAvailableServices: () => {
      const { services, hiddenServices } = get();
      return services.filter(service => 
        service.status === 'available' && !hiddenServices.includes(service.id)
      );
    },

    getServiceById: (serviceId) => {
      const { services } = get();
      return services.find(service => service.id === serviceId);
    },

    needsRefresh: () => {
      const { lastFetched, cacheSettings } = get();
      if (!lastFetched) return true;
      return Date.now() - lastFetched > cacheSettings.servicesListTTL;
    },

    // Enhanced actions
    setServiceConfig: (serviceId, config) => {
      const { serviceConfigs } = get();
      const defaultConfig = {
        enabled: true,
        priority: 0,
      };
      set({
        serviceConfigs: {
          ...serviceConfigs,
          [serviceId]: {
            ...defaultConfig,
            ...serviceConfigs[serviceId],
            ...config,
          },
        },
      });
    },

    getServiceConfig: (serviceId) => {
      const { serviceConfigs } = get();
      return serviceConfigs[serviceId];
    },

    recordPerformanceMetric: (serviceId, responseTime, success) => {
      const { performanceMetrics } = get();
      const existing = performanceMetrics[serviceId] || {
        averageResponseTime: 0,
        successRate: 0,
        lastSuccessfulRequest: 0,
        errorCount: 0,
        totalRequests: 0,
      };

      const totalRequests = existing.totalRequests + 1;
      const errorCount = success ? existing.errorCount : existing.errorCount + 1;
      const successRate = (totalRequests - errorCount) / totalRequests;
      const averageResponseTime = (existing.averageResponseTime * existing.totalRequests + responseTime) / totalRequests;

      set({
        performanceMetrics: {
          ...performanceMetrics,
          [serviceId]: {
            averageResponseTime,
            successRate,
            lastSuccessfulRequest: success ? Date.now() : existing.lastSuccessfulRequest,
            errorCount,
            totalRequests,
          },
        },
      });
    },

    getServiceMetrics: (serviceId) => {
      const { performanceMetrics } = get();
      return performanceMetrics[serviceId];
    },

    resetServiceMetrics: (serviceId) => {
      const { performanceMetrics } = get();
      const newMetrics = { ...performanceMetrics };
      delete newMetrics[serviceId];
      set({ performanceMetrics: newMetrics });
    },

    setCacheSettings: (settings) => {
      const { cacheSettings } = get();
      set({ cacheSettings: { ...cacheSettings, ...settings } });
    },

    isHealthCheckExpired: (serviceId) => {
      const { healthChecks, cacheSettings } = get();
      const check = healthChecks[serviceId];
      if (!check) return true;
      return Date.now() - check.lastCheck > cacheSettings.healthCheckTTL;
    },

    isAuthStatusExpired: (serviceId) => {
      const { authStatus, cacheSettings } = get();
      const auth = authStatus[serviceId];
      if (!auth) return true;
      return Date.now() - auth.lastCheck > cacheSettings.authStatusTTL;
    },

    bulkUpdateServiceStatus: (updates) => {
      const { services } = get();
      const newServices = services.map(service => {
        const update = updates.find(u => u.serviceId === service.id);
        return update ? { ...service, status: update.status } : service;
      });
      set({ services: newServices });
    },

    reorderPreferredServices: (fromIndex, toIndex) => {
      const { preferredServices } = get();
      const newPreferred = [...preferredServices];
      const [removed] = newPreferred.splice(fromIndex, 1);
      newPreferred.splice(toIndex, 0, removed);
      set({ preferredServices: newPreferred });
    },
      }),
      {
        name: 'unshackle-services-store',
        partialize: (state) => ({
          preferredServices: state.preferredServices,
          hiddenServices: state.hiddenServices,
          serviceConfigs: state.serviceConfigs,
          cacheSettings: state.cacheSettings,
          // Don't persist services data, health checks, auth status - should be fresh
        }),
      }
    )
  )
);