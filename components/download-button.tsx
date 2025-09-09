'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, AlertCircle, Check } from 'lucide-react';
import { useServiceAvailability } from '@/lib/hooks/use-download';

interface StreamingOffer {
  id: string;
  package: {
    clearName: string;
    technicalName: string;
    id: string;
  };
  standardWebURL: string;
  country?: string;
}

interface DownloadButtonProps {
  offer: StreamingOffer;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onDownloadClick?: (offer: StreamingOffer, serviceMatch: any) => void;
  debugMode?: boolean;
}

export function DownloadButton({ 
  offer, 
  className = '', 
  size = 'sm',
  onDownloadClick,
  debugMode = process.env.NODE_ENV === 'development'
}: DownloadButtonProps) {
  const { checkAvailability, isLoading, error } = useServiceAvailability();
  const [serviceMatch, setServiceMatch] = useState<any>(null);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (!offer.standardWebURL || hasChecked) return;

    const checkUnshackleSupport = async () => {
      // Clean URL by removing query parameters for better matching
      const cleanUrl = offer.standardWebURL.split('?')[0];
      
      console.log('[DownloadButton] Original URL:', offer.standardWebURL);
      console.log('[DownloadButton] Clean URL:', cleanUrl);
      console.log('[DownloadButton] Service:', offer.package?.clearName);
      
      try {
        const matches = await checkAvailability([cleanUrl]);
        console.log('[DownloadButton] API response:', matches);
        
        const match = matches.find(m => m.url === cleanUrl);
        console.log('[DownloadButton] Service match:', match);
        
        setServiceMatch(match);
        setHasChecked(true);
      } catch (err) {
        console.error('[DownloadButton] Failed to check Unshackle support:', err);
        setHasChecked(true);
      }
    };

    // Small delay to avoid overwhelming the API
    const timeoutId = setTimeout(checkUnshackleSupport, Math.random() * 500);
    return () => clearTimeout(timeoutId);
  }, [offer.standardWebURL, checkAvailability, hasChecked]);

  const handleDownload = () => {
    if (serviceMatch?.supported && onDownloadClick) {
      console.log('[DownloadButton] Starting download with offer:', {
        service: serviceMatch.service,
        country: offer.country,
        url: offer.standardWebURL,
        serviceName: offer.package?.clearName
      });
      
      // Ensure country is preserved in the offer object
      const offerWithCountry = {
        ...offer,
        country: offer.country || 'us' // Fallback to 'us' if country is missing
      };
      
      onDownloadClick(offerWithCountry, serviceMatch);
    }
  };

  // Don't show button if we haven't checked yet or if checking failed
  if (!hasChecked || error) {
    console.log('[DownloadButton] Not showing button - hasChecked:', hasChecked, 'error:', error);
    
    if (debugMode && hasChecked) {
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          <Button variant="outline" disabled className="h-7 px-2 text-xs border-red-200 text-red-600">
            <AlertCircle className="h-3 w-3" />
            <span className="ml-1">Check Failed</span>
          </Button>
          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
            Error: {error || 'Unknown'}
          </Badge>
        </div>
      );
    }
    
    return null;
  }

  // Don't show button if service is not supported
  if (!serviceMatch?.supported) {
    console.log('[DownloadButton] Not showing button - service not supported:', serviceMatch);
    
    if (debugMode) {
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          <Button variant="outline" disabled className="h-7 px-2 text-xs border-gray-200 text-gray-600">
            <AlertCircle className="h-3 w-3" />
            <span className="ml-1">No Match</span>
          </Button>
        </div>
      );
    }
    
    return null;
  }

  console.log('[DownloadButton] Showing download button for service:', serviceMatch?.service);

  const buttonSize = {
    sm: 'h-7 px-2 text-xs',
    md: 'h-8 px-3 text-sm',
    lg: 'h-9 px-4 text-sm'
  }[size];

  const iconSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-4 w-4'
  }[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        onClick={handleDownload}
        disabled={isLoading}
        variant="outline"
        className={`${buttonSize} text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300`}
      >
        {isLoading ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : (
          <Download className={iconSize} />
        )}
        <span className="ml-1">Download</span>
      </Button>
      
      {serviceMatch?.service && (
        <Badge 
          variant="outline" 
          className="text-xs bg-green-50 text-green-700 border-green-200"
        >
          {serviceMatch.service}
        </Badge>
      )}
    </div>
  );
}

/**
 * Component to show download availability status for multiple offers
 */
interface DownloadAvailabilityProps {
  offers: StreamingOffer[];
  onDownloadClick?: (offer: StreamingOffer, serviceMatch: any) => void;
  className?: string;
}

export function DownloadAvailability({ 
  offers, 
  onDownloadClick, 
  className = '' 
}: DownloadAvailabilityProps) {
  const { checkAvailability, isLoading } = useServiceAvailability();
  const [availableServices, setAvailableServices] = useState<Record<string, any>>({});
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (!offers.length || hasChecked) return;

    const checkAllOffers = async () => {
      try {
        const urls = offers
          .map(offer => offer.standardWebURL)
          .filter(url => url); // Filter out empty URLs

        if (urls.length === 0) {
          setHasChecked(true);
          return;
        }

        const matches = await checkAvailability(urls);
        const serviceMap = matches.reduce((acc, match) => {
          if (match.supported) {
            acc[match.url] = match;
          }
          return acc;
        }, {} as Record<string, any>);

        setAvailableServices(serviceMap);
        setHasChecked(true);
      } catch (err) {
        console.error('Failed to check offers availability:', err);
        setHasChecked(true);
      }
    };

    checkAllOffers();
  }, [offers, checkAvailability, hasChecked]);

  if (!hasChecked || isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Checking download availability...</span>
      </div>
    );
  }

  const availableCount = Object.keys(availableServices).length;

  if (availableCount === 0) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">No download sources available</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Check className="h-4 w-4 text-green-600" />
      <span className="text-sm text-green-600 font-medium">
        {availableCount} download source{availableCount !== 1 ? 's' : ''} available
      </span>
      <Badge variant="secondary" className="bg-green-100 text-green-800">
        {Object.values(availableServices).map((service: any) => service.service).join(', ')}
      </Badge>
    </div>
  );
}