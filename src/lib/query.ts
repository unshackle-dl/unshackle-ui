import { QueryClient } from '@tanstack/react-query';

// ponytail: a module singleton, not a per-request client. This is an SPA with no SSR
// data fetching, so there is no request to isolate cache between.
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// The API is a local/self-hosted service: refetching on every focus is noise.
			refetchOnWindowFocus: false,
			retry: false
		}
	}
});
