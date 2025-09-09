'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DownloadButton } from '@/components/download-button';
import { useApiHealth, useServiceAvailability } from '@/lib/hooks/use-download';

export default function TestDownloadPage() {
  const { isHealthy, isChecking, checkHealth } = useApiHealth();
  const { checkAvailability, isLoading, error } = useServiceAvailability();
  const [results, setResults] = useState<any>(null);

  const testAppleTvUrl = "https://tv.apple.com/us/movie/the-amateur/umc.cmc.48jzce732oqrkjx98fjts85gn?at=1000l3V2&ct=app_tv&itscg=30200&itsct=justwatch_tv_12&playableId=tvs.sbd.9001%3A1814002881";

  const handleTestAvailability = async () => {
    try {
      const matches = await checkAvailability([testAppleTvUrl]);
      setResults(matches);
    } catch (err) {
      console.error('Test failed:', err);
      setResults({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const mockOffer = {
    id: "test-1",
    package: {
      clearName: "Apple TV+",
      technicalName: "atvp",
      id: "atvp-id"
    },
    standardWebURL: testAppleTvUrl,
    country: "US"
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Download Button Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">API Health Status</h3>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>{isHealthy ? 'Healthy' : 'Unhealthy'}</span>
              <Button onClick={checkHealth} disabled={isChecking} size="sm" variant="outline">
                {isChecking ? 'Checking...' : 'Check Health'}
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-medium mb-2">Test Apple TV+ URL</h3>
            <p className="text-sm text-muted-foreground mb-2 break-all">{testAppleTvUrl}</p>
            <Button onClick={handleTestAvailability} disabled={isLoading}>
              {isLoading ? 'Testing...' : 'Test Availability'}
            </Button>
            {error && <p className="text-red-600 text-sm mt-2">Error: {error}</p>}
          </div>

          {results && (
            <div>
              <h3 className="font-medium mb-2">API Results</h3>
              <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}

          <div>
            <h3 className="font-medium mb-2">Download Button Test</h3>
            <DownloadButton 
              offer={mockOffer}
              debugMode={true}
              onDownloadClick={(offer, serviceMatch) => {
                console.log('Download clicked:', { offer, serviceMatch });
                alert(`Download clicked for ${offer.package.clearName} - Service: ${serviceMatch.service}`);
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}