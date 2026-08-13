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
		<aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
			<div className="px-5 py-5">
				<div className="flex items-center gap-2">
					{/* Material Symbols: no_encryption */}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="26"
						height="26"
						viewBox="0 -960 960 960"
						fill="currentColor"
						className="text-accent-600 dark:text-accent-500"
						aria-hidden="true"
					>
						<path d="m800-274-80-80v-206H514l-80-80h166v-80q0-50-34.5-85T481-840q-50 0-84 34.5T363-720v9l-73-73q22-61 75-98.5T481-920q83 0 141 58.5T680-720v80h40q33 0 56.5 23.5T800-560v286Zm20 246-62-62q-11 5-20 7.5T720-80H240q-33 0-56.5-23.5T160-160v-400q0-25 14.5-46t37.5-30L28-820l56-56L876-84l-56 56ZM686-160 539-309q-11 11-25.5 17t-31.5 6q-33 0-56.5-23.5T402-366q0-17 6-31.5t17-25.5L286-560h-46v400h446ZM486-360Zm131-97Z" />
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
