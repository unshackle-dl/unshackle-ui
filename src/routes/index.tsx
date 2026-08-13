import { useMutation, useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useMatchRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '$lib/api/client';
import Badge from '$lib/components/Badge';
import Button from '$lib/components/Button';
import Card from '$lib/components/Card';
import EmptyState from '$lib/components/EmptyState';
import Icon from '$lib/components/Icon';
import PosterGrid from '$lib/components/PosterGrid';
import { useSettings } from '$lib/config';
import { popularQuery, profilesQuery, servicesQuery } from '$lib/queries';
import { useMask } from '$lib/stores/incognito';

export const Route = createFileRoute('/')({ component: Browse });

function Browse() {
	const mask = useMask();
	const navigate = useNavigate();

	const services = useQuery(servicesQuery);
	const serviceList = services.data ?? [];

	const [service, setService] = useState('');
	// Default to ATV once services land, without clobbering a later manual pick.
	useEffect(() => {
		if (!service && serviceList.length)
			setService(serviceList.find((s) => s.tag === 'ATV')?.tag ?? serviceList[0].tag);
	}, [service, serviceList]);

	const [query, setQuery] = useState('');

	// Named credential profiles per service; only shown for services that have them.
	const profiles = useQuery(profilesQuery);
	const profileOptions = profiles.data?.[service] ?? [];
	const [profile, setProfile] = useState('');
	// Preselect a named profile ("default" is just one of them, not a synthetic entry).
	useEffect(() => {
		if (profileOptions.length && !profileOptions.includes(profile))
			setProfile(profileOptions.includes('default') ? 'default' : profileOptions[0]);
	}, [profileOptions, profile]);

	// Proxy: a URI or country code. Geofenced services suggest their own country codes.
	const [proxy, setProxy] = useState('');
	const [noProxy, setNoProxy] = useState(false);
	const geofence = serviceList.find((s) => s.tag === service)?.geofence ?? [];

	// Search params carried through to the title page.
	const browseSearch = {
		...(profile ? { profile } : {}),
		...(proxy.trim() ? { proxy: proxy.trim() } : {}),
		...(noProxy ? { no_proxy: true } : {})
	};

	// id of the result currently being opened, for per-row loading feedback.
	const matchRoute = useMatchRoute();
	const pendingTitle = matchRoute({ to: '/title/$service/$id', pending: true });
	const pendingId = pendingTitle ? pendingTitle.id : null;

	const search = useMutation({
		mutationFn: () =>
			api.search({
				service,
				query: query.trim(),
				profile: profile || undefined,
				proxy: proxy.trim() || undefined,
				no_proxy: noProxy || undefined
			})
	});
	const results = search.data?.results ?? null;

	// Open a title directly by ID or URL, skipping search (for services with no
	// search, or when you already have the id). The title page feeds it to list-titles.
	const openDirect = useMutation({
		mutationFn: () =>
			navigate({
				to: '/title/$service/$id',
				params: { service, id: query.trim() },
				search: browseSearch
			})
	});

	const canSubmit = Boolean(query.trim() && service);

	// JustWatch popular titles, from this app's own server (not the unshackle API).
	const { country } = useSettings();
	const popular = useQuery(popularQuery(country));

	return (
		<>
			<h1 className="text-2xl font-semibold tracking-tight">Browse</h1>
			<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
				Search a service, or open a title directly by ID or URL.
			</p>

			{services.error && (
				<Card className="mt-6 p-4">
					<div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
						<Icon name="alert" size={16} className="mt-0.5" />
						<span>
							Couldn't load services: {mask.text(errorMessage(services.error))}. Check the{' '}
							<Link to="/settings" className="font-medium underline">
								API settings
							</Link>
							.
						</span>
					</div>
				</Card>
			)}

			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (canSubmit) search.mutate();
				}}
				className="mt-6 space-y-2.5"
			>
				<div className="flex flex-wrap gap-3">
					<div className="relative">
						<select
							value={service}
							onChange={(e) => {
								setService(e.target.value);
								setProfile('');
								setProxy('');
								setNoProxy(false);
							}}
							className="appearance-none rounded-lg border border-neutral-200 bg-white py-2 pr-9 pl-3 text-sm font-medium text-neutral-900 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
							aria-label="Service"
						>
							{serviceList.map((s) => (
								<option key={s.tag} value={s.tag}>
									{mask.service(s.tag)}
								</option>
							))}
						</select>
						<div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-neutral-400">
							<Icon name="chevron" size={16} className="rotate-90" />
						</div>
					</div>

					<div className="relative min-w-64 flex-1">
						<div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
							<Icon name="search" size={16} />
						</div>
						<input
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							type="search"
							placeholder="Search titles, or paste a title ID / URL..."
							className="redact w-full rounded-lg border border-neutral-200 bg-white py-2 pr-3 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
						/>
					</div>

					<Button type="submit" disabled={search.isPending || !canSubmit}>
						{search.isPending ? (
							<>
								<Icon name="loader" spin />
								Searching...
							</>
						) : (
							'Search'
						)}
					</Button>
					<Button
						type="button"
						variant="secondary"
						onClick={() => openDirect.mutate()}
						disabled={openDirect.isPending || !canSubmit}
						title="Load this exact title ID or URL without searching"
					>
						{openDirect.isPending ? (
							<>
								<Icon name="loader" spin />
								Opening...
							</>
						) : (
							<>
								Open <Icon name="chevron" size={16} />
							</>
						)}
					</Button>
				</div>

				{/* The only options search accepts: profile, proxy, no_proxy. */}
				<div className="flex flex-wrap items-center gap-2 pl-0.5 text-xs text-neutral-500 dark:text-neutral-400">
					<span className="font-medium">Options</span>

					{profileOptions.length > 0 && (
						<div className="relative">
							<select
								value={profile}
								onChange={(e) => setProfile(e.target.value)}
								className="appearance-none rounded-md border border-neutral-200 bg-white py-1 pr-7 pl-2.5 text-xs font-medium text-neutral-900 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
								aria-label="Profile"
							>
								{profileOptions.map((p) => (
									<option key={p} value={p}>
										{mask.profile(p)}
									</option>
								))}
							</select>
							<div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-neutral-400">
								<Icon name="chevron" size={13} className="rotate-90" />
							</div>
						</div>
					)}

					<input
						value={proxy}
						onChange={(e) => setProxy(e.target.value)}
						type="text"
						list={`geofence-${service}`}
						disabled={noProxy}
						placeholder={
							geofence.length ? `Proxy / country (e.g. ${geofence[0]})` : 'Proxy URI or country'
						}
						title={
							geofence.length
								? `Geofenced to: ${geofence.join(', ')}. Set a proxy URI or country code.`
								: 'Set a proxy URI or country code.'
						}
						className="redact w-44 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
						aria-label="Proxy or country code"
					/>
					{geofence.length > 0 && (
						<datalist id={`geofence-${service}`}>
							{geofence.map((g) => (
								<option key={g} value={g} />
							))}
						</datalist>
					)}
					<button
						type="button"
						onClick={() => setNoProxy((v) => !v)}
						aria-pressed={noProxy}
						title="Force disable all proxy use for this search"
						className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
							noProxy
								? 'bg-accent-600 text-white'
								: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
						}`}
					>
						No proxy
					</button>
				</div>
			</form>

			{search.error ? (
				<Card className="mt-6 p-4">
					<div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
						<Icon name="alert" size={16} className="mt-0.5" />
						<span>{mask.text(errorMessage(search.error))}</span>
					</div>
				</Card>
			) : results ? (
				results.length === 0 ? (
					<Card className="mt-6">
						<EmptyState
							icon="search"
							title="No results"
							description="Try a different query or service."
						/>
					</Card>
				) : (
					<Card
						className={`mt-6 divide-y divide-neutral-100 dark:divide-neutral-800 ${
							pendingId ? 'pointer-events-none' : ''
						}`}
					>
						{results.map((r) => (
							<Link
								key={r.id}
								to="/title/$service/$id"
								params={{ service, id: r.id }}
								search={browseSearch}
								className={`flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
									pendingId && pendingId !== r.id ? 'opacity-40' : ''
								}`}
							>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="truncate font-medium text-neutral-900 dark:text-neutral-100">
											{mask.title(r.title)}
										</span>
										{r.label && <Badge tone="accent">{r.label}</Badge>}
									</div>
									{r.description && (
										<p className="mt-0.5 truncate text-sm text-neutral-500 dark:text-neutral-400">
											{mask.text(r.description)}
										</p>
									)}
									<p className="mt-0.5 truncate font-mono text-xs text-neutral-400 dark:text-neutral-500">
										{mask.id(r.id)}
									</p>
								</div>
								{pendingId === r.id ? (
									<Icon name="loader" size={18} spin className="shrink-0 text-accent-500" />
								) : (
									<Icon
										name="chevron"
										size={18}
										className="shrink-0 text-neutral-300 dark:text-neutral-600"
									/>
								)}
							</Link>
						))}
					</Card>
				)
			) : null}

			{popular.data ? (
				<div className="mt-10 space-y-8">
					<section>
						<PopularHeader label="Popular movies" type="movies" />
						<PosterGrid titles={popular.data.movies} />
					</section>
					<section>
						<PopularHeader label="Popular TV" type="tv" />
						<PosterGrid titles={popular.data.shows} />
					</section>
				</div>
			) : popular.error ? (
				<p className="mt-10 text-sm text-neutral-400 dark:text-neutral-500">
					Couldn't load popular titles from JustWatch.
				</p>
			) : null}
		</>
	);
}

function PopularHeader({ label, type }: { label: string; type: 'movies' | 'tv' }) {
	return (
		<div className="flex items-baseline gap-3">
			<h2 className="text-lg font-semibold tracking-tight">{label}</h2>
			<Link
				to="/popular/$type"
				params={{ type }}
				className="inline-flex items-center gap-0.5 text-sm font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
			>
				All
				<Icon name="chevron" size={16} />
			</Link>
		</div>
	);
}
