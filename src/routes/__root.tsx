import { QueryClientProvider } from '@tanstack/react-query';
import {
	createRootRoute,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useRouterState
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import appCss from '../app.css?url';
import Card from '$lib/components/Card';
import EmptyState from '$lib/components/EmptyState';
import Sidebar from '$lib/components/Sidebar';
import TrackingBanner from '$lib/components/TrackingBanner';
import { queryClient } from '$lib/query';
import '$lib/stores/theme';
import '$lib/stores/accent';
import '$lib/stores/fonts';

// Applies theme + accent before paint to avoid a flash. Runs before React hydrates,
// so it duplicates a little of what the theme store does on load.
const preloadTheme = `try {
	var t = localStorage.getItem('unshackle.theme');
	var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
	if (dark) document.documentElement.classList.add('dark');
} catch (e) {}`;

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ title: 'unshackle' }
		],
		links: [
			{ rel: 'stylesheet', href: appCss },
			{ rel: 'icon', href: '/favicon.svg' }
		],
		scripts: [{ children: preloadTheme }]
	}),
	shellComponent: RootDocument,
	component: RootLayout,
	notFoundComponent: NotFound
});

function RootDocument({ children }: { children: ReactNode }) {
	return (
		// The pre-paint script and the accent store both mutate documentElement (class,
		// --accent-* vars) before React hydrates, so its attributes never match the shell.
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

function NotFound() {
	return (
		<Card className="mt-6">
			<EmptyState icon="alert" title="Page not found" description="This page doesn't exist." />
			<div className="pb-8 text-center">
				<Link to="/" className="text-sm font-medium text-accent-600 underline dark:text-accent-400">
					Back to Browse
				</Link>
			</div>
		</Card>
	);
}

function RootLayout() {
	const navigating = useRouterState({ select: (s) => s.isLoading });

	return (
		<QueryClientProvider client={queryClient}>
			{navigating && (
				/* Top progress bar shown while a navigation/load is in flight */
				<div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-accent-500/20">
					<div className="h-full w-1/3 animate-pulse bg-accent-500" />
				</div>
			)}

			<div className="flex h-screen overflow-hidden text-neutral-900 dark:text-neutral-100">
				<Sidebar />
				<main className="flex-1 overflow-y-auto">
					<div className="mx-auto max-w-6xl px-8 py-8">
						{/* Inside QueryClientProvider, and above the page rather than floating over
						    it: this codebase has no toast layer and does not need one. Renders
						    nothing at all unless the server reports itself stale. */}
						<TrackingBanner />
						<Outlet />
					</div>
				</main>
			</div>
		</QueryClientProvider>
	);
}
