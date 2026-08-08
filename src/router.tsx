import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export function getRouter() {
	return createRouter({
		routeTree,
		// Preload on hover, so opening a title has its loader already in flight.
		defaultPreload: 'intent',
		scrollRestoration: true
	});
}

// Without this the route tree is never registered, and every Link `to`, param and
// search object silently degrades to an unchecked string.
declare module '@tanstack/react-router' {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
