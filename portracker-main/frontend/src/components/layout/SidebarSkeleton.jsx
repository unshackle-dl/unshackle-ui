import { Skeleton } from "@/components/ui/skeleton";

export function SidebarSkeleton() {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="p-6 flex-shrink-0">
        <div className="mb-6">
          <div className="flex items-center mb-1">
            <Skeleton className="h-5 w-5 mr-2" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-4 w-32 mt-1" />
        </div>
        <div className="flex items-center mb-3">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-8 ml-1" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700/50"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Skeleton className="h-4 w-4 mr-2" />
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="flex items-center space-x-1">
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Skeleton className="h-3 w-3 mr-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="flex items-center">
                  <Skeleton className="h-3 w-3 mr-1" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <Skeleton className="h-3 w-3 mr-1" />
                  <Skeleton className="h-3 w-14" />
                </div>
                <div className="flex items-center">
                  <Skeleton className="h-3 w-3 mr-1" />
                  <Skeleton className="h-3 w-18" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 mt-auto flex-shrink-0">
        <div className="w-full p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center">
          <Skeleton className="h-5 w-5 mb-1" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}
