import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { type Theme, type TabId, type ConnectionStatus } from '@/lib/types';

interface NotificationState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
  timestamp: number;
}

interface UIState {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Navigation
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;

  // Modals
  modals: Record<string, boolean>;
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  toggleModal: (modalId: string) => void;

  // Notifications
  notifications: NotificationState[];
  addNotification: (notification: Omit<NotificationState, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Connection Status
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: Partial<ConnectionStatus>) => void;

  // Loading States
  globalLoading: boolean;
  setGlobalLoading: (loading: boolean) => void;

  // Layout
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // View Preferences
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  compactMode: boolean;
  setCompactMode: (compact: boolean) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Search History
  searchHistory: string[];
  addToSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
}

export const useUIStore = create<UIState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        theme: 'system',
        activeTab: 'search',
        modals: {},
        notifications: [],
        connectionStatus: {
          unshackle: 'disconnected',
          tmdb: 'disconnected',
          websocket: 'disconnected',
        },
        globalLoading: false,
        sidebarOpen: false,
        viewMode: 'grid',
        compactMode: false,
        searchQuery: '',
        searchHistory: [],

        // Theme actions
        setTheme: (theme) => {
          set({ theme });
          
          // Apply theme to document
          const root = window.document.documentElement;
          root.classList.remove('light', 'dark');

          if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
            root.classList.add(systemTheme);
          } else {
            root.classList.add(theme);
          }
        },

        // Navigation actions
        setActiveTab: (tab) => set({ activeTab: tab }),

        // Modal actions
        openModal: (modalId) => set((state) => ({
          modals: { ...state.modals, [modalId]: true },
        })),

        closeModal: (modalId) => set((state) => ({
          modals: { ...state.modals, [modalId]: false },
        })),

        toggleModal: (modalId) => {
          const { modals } = get();
          const isOpen = modals[modalId];
          if (isOpen) {
            get().closeModal(modalId);
          } else {
            get().openModal(modalId);
          }
        },

        // Notification actions
        addNotification: (notification) => {
          const id = Math.random().toString(36).substring(2);
          const newNotification: NotificationState = {
            ...notification,
            id,
            timestamp: Date.now(),
          };

          set((state) => ({
            notifications: [newNotification, ...state.notifications],
          }));

          // Auto-remove notification after duration (default 5 seconds)
          const duration = notification.duration || 5000;
          if (duration > 0) {
            setTimeout(() => {
              get().removeNotification(id);
            }, duration);
          }
        },

        removeNotification: (id) => set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id),
        })),

        clearNotifications: () => set({ notifications: [] }),

        // Connection status actions
        setConnectionStatus: (status) => set((state) => ({
          connectionStatus: { ...state.connectionStatus, ...status },
        })),

        // Loading actions
        setGlobalLoading: (loading) => set({ globalLoading: loading }),

        // Layout actions
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

        // View preferences
        setViewMode: (mode) => set({ viewMode: mode }),
        setCompactMode: (compact) => set({ compactMode: compact }),

        // Search actions
        setSearchQuery: (query) => set({ searchQuery: query }),

        // Search history
        addToSearchHistory: (query) => {
          const { searchHistory } = get();
          const trimmedQuery = query.trim();
          
          if (!trimmedQuery || searchHistory.includes(trimmedQuery)) {
            return;
          }

          const newHistory = [trimmedQuery, ...searchHistory.slice(0, 9)]; // Keep only 10 items
          set({ searchHistory: newHistory });
        },

        clearSearchHistory: () => set({ searchHistory: [] }),
      }),
      {
        name: 'unshackle-ui-store',
        partialize: (state) => ({
          theme: state.theme,
          viewMode: state.viewMode,
          compactMode: state.compactMode,
          searchHistory: state.searchHistory,
          sidebarOpen: state.sidebarOpen,
        }),
      }
    )
  )
);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  mediaQuery.addEventListener('change', () => {
    const { theme, setTheme } = useUIStore.getState();
    if (theme === 'system') {
      setTheme('system'); // Trigger theme update
    }
  });
}