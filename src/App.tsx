import { useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import { SearchPage } from '@/pages/search-page';
import { QueuePage } from '@/pages/queue-page';
import { HistoryPage } from '@/pages/history-page';
import { ServicesPage } from '@/pages/services-page';
import { WebSocketProvider } from '@/contexts/websocket-context';
import { useUIStore, useServicesStore, useDownloadsStore, useSearchStore } from '@/stores';
import { mockServices, mockDownloadJobs, mockSearchResults } from '@/lib/mock-data';

function App() {
  const { activeTab, theme, setTheme } = useUIStore();
  const { setServices } = useServicesStore();
  const { setJobs } = useDownloadsStore();
  const { setAggregatedResults } = useSearchStore();

  // Initialize app data
  useEffect(() => {
    setTheme(theme);
    
    // Initialize mock data
    setServices(mockServices);
    setJobs(mockDownloadJobs);
    
    // Set some mock search results for demo
    setAggregatedResults(mockSearchResults);
  }, [setTheme, setServices, setJobs, setAggregatedResults, theme]);

  const renderActivePage = () => {
    switch (activeTab) {
      case 'search':
        return <SearchPage />;
      case 'queue':
        return <QueuePage />;
      case 'history':
        return <HistoryPage />;
      case 'services':
        return <ServicesPage />;
      default:
        return <SearchPage />;
    }
  };

  return (
    <WebSocketProvider>
      <AppLayout>
        {renderActivePage()}
      </AppLayout>
    </WebSocketProvider>
  );
}

export default App;
