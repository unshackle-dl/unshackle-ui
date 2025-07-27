import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0 || bytes === undefined || bytes === null) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatUptime(totalSeconds, short = false) {
  if (totalSeconds === undefined || totalSeconds === null || totalSeconds < 0) return 'N/A';
  if (totalSeconds === 0) return short ? '0m' : 'Just now';

  const days = Math.floor(totalSeconds / (3600 * 24));
  const hoursRemainder = totalSeconds % (3600 * 24);
  const hours = Math.floor(hoursRemainder / 3600);
  const minutesRemainder = hoursRemainder % 3600;
  const minutes = Math.floor(minutesRemainder / 60);

  if (short) {
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }

  let uptimeString = '';
  if (days > 0) uptimeString += `${days}d `;
  if (hours > 0) uptimeString += `${hours}h `;
  if (minutes > 0 || (days === 0 && hours === 0)) uptimeString += `${minutes}m`; 
  
  return uptimeString.trim() || '0m';
}

export function formatCpuSpeed(mhz) {
  if (!mhz || mhz <= 0) return '';
  return (mhz / 1000).toFixed(2) + ' GHz';
}

export function formatCreatedDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString.replace(" +0000 UTC", "Z"));
  if (isNaN(date.getTime())) return dateString;

  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffMonth >= 1) return `${diffMonth} month${diffMonth > 1 ? "s" : ""} ago`;
  if (diffWeek >= 1) return `${diffWeek} week${diffWeek > 1 ? "s" : ""} ago`;
  if (diffDay >= 1) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  if (diffHr >= 1) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
  if (diffMin >= 1) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
  return "just now";
}

export function formatCreatedTooltip(dateString) {
  if (!dateString) return "Created: N/A";
  const date = new Date(dateString.replace(" +0000 UTC", "Z"));
  if (isNaN(date.getTime())) return `Created: ${dateString}`;
  return (
    "Created: " +
    date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    })
  );
}

/**
 * Determines which field(s) matched the search term for a port
 * @param {Object} port - The port object
 * @param {string} searchTerm - The search term
 * @returns {Object} - Object with boolean flags for what matched
 */
export function getSearchMatches(port, searchTerm) {
  if (!searchTerm) return {};
  
  const searchLower = searchTerm.toLowerCase();
  
  return {
    hostPort: port.host_port.toString().includes(searchLower),
    owner: port.owner && port.owner.toLowerCase().includes(searchLower),
    hostIp: port.host_ip && port.host_ip.includes(searchLower),
    target: port.target && port.target.includes && port.target.includes(searchLower),
    note: port.note && port.note.toLowerCase().includes(searchLower)
  };
}

/**
 * Highlights matching text in a string
 * @param {string} text - The text to highlight
 * @param {string} searchTerm - The search term to highlight
 * @returns {Object|string} - Object with parts array for highlighting or original string
 */
export function highlightText(text, searchTerm) {
  if (!searchTerm || !text) return text;
  
  const searchLower = searchTerm.toLowerCase();
  const textLower = text.toLowerCase();
  
  if (!textLower.includes(searchLower)) return text;
  
  const startIndex = textLower.indexOf(searchLower);
  const endIndex = startIndex + searchTerm.length;
  
  return {
    isHighlighted: true,
    parts: [
      { text: text.substring(0, startIndex), highlighted: false },
      { text: text.substring(startIndex, endIndex), highlighted: true },
      { text: text.substring(endIndex), highlighted: false }
    ]
  };
}
