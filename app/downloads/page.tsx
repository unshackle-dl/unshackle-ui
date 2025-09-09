import { DownloadProgress } from '@/components/download-progress';
import { Header } from '@/components/header';

export default function DownloadsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Downloads</h1>
            <p className="text-muted-foreground mt-2">
              Monitor and manage your Unshackle downloads
            </p>
          </div>
          
          <DownloadProgress />
        </div>
      </div>
    </div>
  );
}