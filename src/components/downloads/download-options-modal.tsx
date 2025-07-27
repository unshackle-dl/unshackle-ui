import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { type EnhancedSearchResult, type DownloadOptions } from '@/lib/types';

interface DownloadOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: DownloadOptions) => void;
  result: EnhancedSearchResult;
  isLoading?: boolean;
}

export function DownloadOptionsModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  result,
  isLoading = false
}: DownloadOptionsModalProps) {
  const [options, setOptions] = useState<DownloadOptions>({
    quality: '1080p',
    hdr10: false,
    dolby_vision: false,
    atmos: false,
    subtitles: true,
    audio_tracks: [],
  });
  
  const handleConfirm = () => {
    onConfirm(options);
    onClose();
  };
  
  const updateOption = <K extends keyof DownloadOptions>(
    key: K, 
    value: DownloadOptions[K]
  ) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Download Options</DialogTitle>
          <DialogDescription>
            Configure quality and features for {result.displayTitle}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Content Preview */}
          <div className="flex space-x-3">
            {result.posterURL && (
              <img
                src={result.posterURL}
                alt={result.displayTitle}
                className="w-16 h-24 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <h3 className="font-medium">{result.displayTitle}</h3>
              <p className="text-sm text-muted-foreground">{result.displayYear}</p>
              <Badge variant="outline" className="mt-1">
                {result.unshackleResult.service}
              </Badge>
            </div>
          </div>
          
          {/* Quality Selection */}
          <div className="space-y-2">
            <Label>Resolution</Label>
            <Select 
              value={options.quality} 
              onValueChange={(value) => updateOption('quality', value as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="720p">720p HD</SelectItem>
                <SelectItem value="1080p">1080p Full HD</SelectItem>
                <SelectItem value="4k">4K UHD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Advanced Features */}
          <div className="space-y-3">
            <Label>Advanced Features</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="hdr10"
                  checked={options.hdr10}
                  onCheckedChange={(checked) => updateOption('hdr10', !!checked)}
                />
                <Label htmlFor="hdr10" className="text-sm">HDR10</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dolbyVision"
                  checked={options.dolby_vision}
                  onCheckedChange={(checked) => updateOption('dolby_vision', !!checked)}
                />
                <Label htmlFor="dolbyVision" className="text-sm">Dolby Vision</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="atmos"
                  checked={options.atmos}
                  onCheckedChange={(checked) => updateOption('atmos', !!checked)}
                />
                <Label htmlFor="atmos" className="text-sm">Dolby Atmos</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="subtitles"
                  checked={options.subtitles}
                  onCheckedChange={(checked) => updateOption('subtitles', !!checked)}
                />
                <Label htmlFor="subtitles" className="text-sm">Subtitles</Label>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting Download...
              </>
            ) : (
              'Start Download'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}