import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
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
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const useServicesStore = create<ServicesState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    services: [],
    loading: false,
    error: null,
    lastFetched: null,

    healthChecks: {},
    authStatus: {},

    preferredServices: ['NF', 'DSNP', 'AMZN'], // Default preferred services
    hiddenServices: [],

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
      const { lastFetched } = get();
      if (!lastFetched) return true;
      return Date.now() - lastFetched > REFRESH_INTERVAL;
    },
  }))
);