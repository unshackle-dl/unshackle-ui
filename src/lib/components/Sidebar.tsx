import { useQuery } from '@tanstack/react-query';
import { Link, useRouterState } from '@tanstack/react-router';
import { statusQuery } from '$lib/queries';
import { toggleIncognito, useIncognito } from '$lib/stores/incognito';
import AccentPicker from './AccentPicker';
import Icon, { type IconName } from './Icon';
import ThemeToggle from './ThemeToggle';

// `as const` is load-bearing: widened to string, these hrefs no longer satisfy Link's
// typed `to` and every route in the sidebar stops being checked.
const nav = [
	{ href: '/', label: 'Browse', icon: 'search' },
	{ href: '/discover', label: 'Discover', icon: 'compass' },
	{ href: '/downloads', label: 'Downloads', icon: 'download' },
	{ href: '/tracking', label: 'Tracking', icon: 'bell' },
	{ href: '/history', label: 'History', icon: 'history' },
	{ href: '/settings', label: 'Settings', icon: 'settings' }
] as const satisfies readonly { href: string; label: string; icon: IconName }[];

export default function Sidebar() {
	const path = useRouterState({ select: (s) => s.location.pathname });
	const incognito = useIncognito();
	// The status route rather than the full list: it reports the same owner-filtered total
	// in one small response, and the banner in __root already has it cached.
	const status = useQuery(statusQuery);
	const unseen = status.data?.unseen_total ?? 0;

	// JustWatch detail and popular pages are reached from Browse, so they highlight it.
	const active = (href: string) =>
		href === '/'
			? path === '/' ||
				path.startsWith('/title') ||
				path.startsWith('/browse') ||
				path.startsWith('/popular')
			: path.startsWith(href);

	return (
		<aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-[#0F141C]">
			<div className="px-5 py-5">
				<div className="flex items-center gap-2">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="26"
						height="26"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className="text-accent-600 dark:text-accent-500"
						aria-hidden="true"
					>
						<rect width="18" height="11" x="3" y="10" rx="2" />
						<path d="M7 10V7a5 5 0 0 1 9.9-1" />
						<circle cx="12" cy="15" r="1" />
					</svg>
					<span className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
						unshackle-ui
					</span>
				</div>
			</div>

			<nav className="flex-1 space-y-1 px-3 py-2">
				{nav.map((item) => (
					<Link
						key={item.href}
						to={item.href}
						className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
							active(item.href)
								? 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300'
								: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
						}`}
					>
						<Icon name={item.icon} size={18} />
						{item.label}
						{item.href === '/tracking' && unseen > 0 && (
							<span
								className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-accent-600 px-1.5 py-0.5 text-xs font-semibold text-white"
								aria-label={`${unseen} new ${unseen === 1 ? 'episode' : 'episodes'}`}
							>
								{unseen}
							</span>
						)}
					</Link>
				))}
			</nav>

			<div className="flex items-center justify-between border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
				{/* This UI's own build. The server's code hash is separate, shown in Settings. */}
				<div
					className="font-mono text-xs leading-tight text-neutral-400 dark:text-neutral-500"
					title="unshackle-ui version and git commit"
				>
					<div>v{__APP_VERSION__}</div>
					{__APP_COMMIT__ && <div>git {__APP_COMMIT__}</div>}
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<button
						onClick={toggleIncognito}
						className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
							incognito
								? 'text-accent-600 dark:text-accent-400'
								: 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
						}`}
						title="Toggle incognito mode"
						aria-label="Toggle incognito mode"
						aria-pressed={incognito}
					>
						<Icon name={incognito ? 'eye-off' : 'eye'} />
					</button>
					<ThemeToggle />
					<AccentPicker />
				</div>
			</div>
		</aside>
	);
}
