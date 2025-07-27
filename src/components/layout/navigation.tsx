import { Search, Download, History, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores";

interface NavigationProps {
  className?: string;
}

const navigationTabs = [
  { id: 'search', label: 'Search', icon: Search },
  { id: 'queue', label: 'Queue', icon: Download },
  { id: 'history', label: 'History', icon: History },
  { id: 'services', label: 'Services', icon: Settings },
] as const;

export function Navigation({ className }: NavigationProps) {
  const { activeTab, setActiveTab } = useUIStore();

  return (
    <div className={cn("flex-1 overflow-y-auto", className)}>
      <div className="p-4 space-y-2">
        {/* Navigation Items */}
        {navigationTabs.map(({ id, label, icon: Icon }, index) => (
          <Button
            key={id}
            variant={activeTab === id ? "default" : "ghost"}
            onClick={() => setActiveTab(id)}
            className={cn(
              "w-full justify-start space-x-3 h-10 animate-fade-in",
              activeTab === id 
                ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}