import { Server, Zap, HardDrive } from "lucide-react";
import { formatBytes } from "@/lib/utils";

function VMItem({ vm }) {
  const isRunning = vm.status && vm.status.toLowerCase() === "running";
  const statusColor = isRunning ? "bg-green-500" : "bg-red-500";

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusColor}`}></span>
            <Server className="h-6 w-6 text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <h4 className="font-medium text-sm text-slate-900 dark:text-slate-100">
              {vm.name}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
              {vm.status || "Unknown"}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        {vm.vcpus && (
          <span className="inline-flex items-center px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
            <Zap className="h-3 w-3 mr-1" />
            {vm.vcpus} vCPU{vm.vcpus > 1 ? "s" : ""}
          </span>
        )}
        {vm.memory && (
          <span className="inline-flex items-center px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium">
            <HardDrive className="h-3 w-3 mr-1" />
            {formatBytes(vm.memory)}
          </span>
        )}
      </div>
    </div>
  );
}

export function VMsCard({ vms }) {
  if (!vms || vms.length === 0) return null;

  return (
    <div className="p-6 pt-4 space-y-4">
      {vms.map((vm) => (
        <VMItem key={vm.id || vm.name} vm={vm} />
      ))}
    </div>
  );
}
