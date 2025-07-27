import { useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function PortStatusIndicator({
  serverId,
  serverUrl,
  port,
  onProtocolChange,
}) {
  const [reachable, setReachable] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let pingApiUrl = `/api/ping?host_ip=${encodeURIComponent(
      port.host_ip
    )}&host_port=${port.host_port}`;

    if (
      serverId &&
      serverId !== "local" &&
      serverUrl &&
      (port.host_ip === "0.0.0.0" || port.host_ip === "127.0.0.1")
    ) {
      pingApiUrl += `&target_server_url=${encodeURIComponent(serverUrl)}`;
    }

    fetch(pingApiUrl, { signal: controller.signal })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(`API ping failed: ${res.status}`)
      )
      .then((data) => {
        setReachable(data.reachable);
        if (onProtocolChange && data.protocol) {
          onProtocolChange(data.protocol);
        }
      })
      .catch(() => setReachable(false))
      .finally(() => {
        clearTimeout(timeoutId);
        setChecking(false);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [port.host_ip, port.host_port, serverId, serverUrl, onProtocolChange]);

  const getDotState = () => {
    if (checking) {
      return {
        color: "bg-blue-400 animate-pulse",
        title: "Checking port status...",
      };
    }
    if (reachable === null) {
      return {
        color: "bg-gray-400",
        title: "Status unknown",
      };
    }
    return {
      color: reachable ? "bg-green-500" : "bg-red-500",
      title: reachable ? "Port is reachable" : "Port is unreachable",
    };
  };

  const dotState = getDotState();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className={`w-2.5 h-2.5 rounded-full ${dotState.color}`} />
        </TooltipTrigger>
        <TooltipContent>
          <p>{dotState.title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
