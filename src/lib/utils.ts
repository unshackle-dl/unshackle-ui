import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * WebSocket URL construction utilities
 */
export function constructWebSocketURL(baseURL: string, path: string, apiKey: string): string {
  // Convert HTTP base URL to WebSocket URL
  const wsBaseURL = baseURL.replace(/^http/, 'ws');
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${wsBaseURL}${normalizedPath}?token=${apiKey}`;
}

export function getJobWebSocketURL(baseURL: string, jobId: string, apiKey: string): string {
  return constructWebSocketURL(baseURL, `/api/v1/downloads/jobs/${jobId}/events`, apiKey);
}

export function getGlobalWebSocketURL(baseURL: string, apiKey: string): string {
  return constructWebSocketURL(baseURL, '/api/v1/events', apiKey);
}