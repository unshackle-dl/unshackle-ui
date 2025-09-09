'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { 
  Settings, 
  Download, 
  Home, 
  Activity 
} from 'lucide-react';

export function Header() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and main navigation */}
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-2">
              <h1 className="text-xl font-bold">Unshackle</h1>
            </Link>
            
            <nav className="flex items-center space-x-1">
              <Button
                variant={isActive('/') ? 'default' : 'ghost'}
                size="sm"
                asChild
              >
                <Link href="/" className="flex items-center space-x-2">
                  <Home className="h-4 w-4" />
                  <span>Search</span>
                </Link>
              </Button>
              
              <Button
                variant={isActive('/downloads') ? 'default' : 'ghost'}
                size="sm"
                asChild
              >
                <Link href="/downloads" className="flex items-center space-x-2">
                  <Download className="h-4 w-4" />
                  <span>Downloads</span>
                </Link>
              </Button>
            </nav>
          </div>

          {/* Right side navigation */}
          <div className="flex items-center space-x-2">
            <Button
              variant={isActive('/settings') ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link href="/settings" className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </Button>
            
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}