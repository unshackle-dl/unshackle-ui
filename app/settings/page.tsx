'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, Server, Save, CheckCircle2, AlertCircle, Key } from 'lucide-react';
import { Header } from '@/components/header';
import { useToast } from '@/lib/hooks/use-toast';
import { API_CONFIG } from '@/lib/config/api';

export default function SettingsPage() {
  const { toast } = useToast();
  const [apiUrl, setApiUrl] = useState(API_CONFIG.baseUrl);
  const [apiKey, setApiKey] = useState(API_CONFIG.apiKey);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('UNSHACKLE_API_URL', apiUrl);
      localStorage.setItem('UNSHACKLE_API_KEY', apiKey);
    }

    setSaved(true);
    toast({
      title: 'Settings Saved',
      description: 'Please refresh the page for changes to take effect.',
    });

    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('UNSHACKLE_API_URL');
      localStorage.removeItem('UNSHACKLE_API_KEY');
    }

    setApiUrl(process.env.NEXT_PUBLIC_UNSHACKLE_API_URL || 'http://localhost:8786');
    setApiKey(process.env.NEXT_PUBLIC_UNSHACKLE_API_KEY || 'your-secret-key-here');

    toast({
      title: 'Settings Reset',
      description: 'Settings have been reset to defaults. Refresh the page to apply.',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8" />
              Settings
            </h1>
            <p className="text-muted-foreground mt-2">
              Configure your Unshackle API connection settings
            </p>
          </div>

          {saved && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Settings saved successfully! Please refresh the page for changes to take effect.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              These settings configure how the web UI connects to the Unshackle API server. Changes
              require a page refresh to take effect.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                API Server Configuration
              </CardTitle>
              <CardDescription>
                Configure the connection to your Unshackle API server
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="api_url" className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  API Server URL
                </Label>
                <Input
                  id="api_url"
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  placeholder="http://localhost:8786"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  The base URL where your Unshackle API is running (e.g., http://192.168.1.100:8786)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_key" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API Key
                </Label>
                <Input
                  id="api_key"
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="your-secret-key-here"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  The API key configured in your unshackle.yaml file under serve.api_secret
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <Button onClick={handleSave} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </Button>
                <Button onClick={handleReset} variant="outline">
                  Reset to Defaults
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Service Credentials</CardTitle>
              <CardDescription>
                Service credentials (Netflix, Disney+, etc.) are managed in the Unshackle CLI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  To configure service credentials, use the Unshackle CLI:
                  <pre className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                    unshackle cfg --help
                  </pre>
                  Credentials are stored securely on the server and accessed via the API.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
              <CardDescription>
                You can also configure these settings via environment variables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <code className="bg-muted px-2 py-1 rounded">NEXT_PUBLIC_UNSHACKLE_API_URL</code>
                  <p className="text-muted-foreground ml-2 mt-1">API server URL</p>
                </div>
                <div>
                  <code className="bg-muted px-2 py-1 rounded">NEXT_PUBLIC_UNSHACKLE_API_KEY</code>
                  <p className="text-muted-foreground ml-2 mt-1">API authentication key</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
