export const SERVER_TYPES = {
  STANDARD: 'standard',
};

export const SERVER_STATUS = {
  ONLINE: {
    id: 'online',
    label: 'online',
    className: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
  },
  OFFLINE: {
    id: 'offline',
    label: 'offline',
    className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  },
  NO_API: {
    id: 'no_api',
    label: 'no API',
    className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
  }
};

export const ERROR_TYPES = {
  NETWORK: 'network_error',
  API: 'api_error'
};