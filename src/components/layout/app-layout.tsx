import { type ReactNode } from "react";
import { AppHeader } from "./app-header";
import { Navigation } from "./navigation";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Navigation */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border">
        <div className="flex h-full flex-col">
          {/* Logo/Header */}
          <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
            <h1 className="text-lg font-semibold text-sidebar-foreground">Unshackle</h1>
          </div>
          
          {/* Navigation */}
          <Navigation />
          
          {/* Status Bar */}
          <div className="mt-auto p-4 border-t border-sidebar-border">
            <div className="text-xs text-sidebar-foreground space-y-1">
              <div>Unshackle UI v1.0.0</div>
              <div className="text-sidebar-accent-foreground">Ready</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 ml-64">
        {/* Top Header */}
        <AppHeader />
        
        {/* Page Content */}
        <main className={cn(
          "px-6 py-6 animate-fade-in",
          className
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}