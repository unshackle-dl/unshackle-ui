import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * WebSocket URL construction utilities
 */
export function constructWebSocketURL(baseURL: string, path: string, token: string = 'devwork'): string {
  // Convert HTTP base URL to WebSocket URL
  const wsBaseURL = baseURL.replace(/^http/, 'ws');
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${wsBaseURL}${normalizedPath}?token=${token}`;
}

export function getJobWebSocketURL(baseURL: string, jobId: string): string {
  return constructWebSocketURL(baseURL, `/api/v1/jobs/${jobId}/events`);
}

export function getGlobalWebSocketURL(baseURL: string): string {
  return constructWebSocketURL(baseURL, '/api/v1/events');
}