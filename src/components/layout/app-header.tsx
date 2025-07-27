import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores";
import { ConnectionStatusIndicator } from "./connection-status-indicator";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  className?: string;
}

export function AppHeader({ className }: AppHeaderProps) {
  const { theme, setTheme } = useUIStore();

  const toggleTheme = () => {
    const themes: Array<typeof theme> = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setTheme(nextTheme);
  };

  return (
    <header className={cn(
      "relative flex-shrink-0",
      className
    )}>
      <div className="min-h-16 px-4 sm:px-6 py-2 flex items-center justify-end gap-4">
        {/* Connection Status */}
        <ConnectionStatusIndicator showDetails />

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          title={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    </header>
  );
}