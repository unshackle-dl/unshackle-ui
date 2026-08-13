import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { matchOffer } from '$lib/browse/match';
import Badge from '$lib/components/Badge';
import Card from '$lib/components/Card';
import Icon from '$lib/components/Icon';
import { useSettings } from '$lib/config';
import { browseTitleQuery, servicesQuery } from '$lib/queries';
import { useIncognito, useMask } from '$lib/stores/incognito';
import { trackingErrorMessage } from '$lib/tracking/client';

// ssr: false because servicesQuery goes through the browser-only API client, same as
// the title page.
export const Route = createFileRoute('/browse/$id')({
	ssr: false,
	// Optional per-page region override; without it the Settings country applies.
	validateSearch: (s: Record<string, unknown>): { country?: string } =>
		typeof s.country === 'string' && /^[A-Za-z]{2}$/.test(s.country)
			? { country: s.country.toUpperCase() }
			: {},
	component: BrowseTitlePage
});

function BrowseTitlePage() {
	const mask = useMask();
	const incognito = useIncognito();
	const { id } = Route.useParams();
	const search = Route.useSearch();
	const settings = useSettings();
	const country = search.country ?? settings.country;
	const navigate = useNavigate({ from: Route.fullPath });
	const setCountry = (c: string) => navigate({ search: { country: c }, replace: true });

	const detail = useQuery(browseTitleQuery(id, country));
	const services = useQuery(servicesQuery);

	if (detail.error)
		return (
			<>
				<BackLink />
				<Card className="mt-6 p-4">
					<div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
						<Icon name="alert" size={16} className="mt-0.5" />
						<span>{mask.text(trackingErrorMessage(detail.error))}</span>
					</div>
				</Card>
			</>
		);
	if (!detail.data)
		return (
			<>
				<BackLink />
				<div className="mt-10 flex justify-center text-neutral-400">
					<Icon name="loader" size={24} spin />
				</div>
			</>
		);

	const { title, offers, countries } = detail.data;
	const regionOptions = countries.includes(country) ? countries : [country, ...countries];

	// Matched services first, each group A-Z by provider name.
	const rows = offers.map((offer) => ({
		offer,
		match: matchOffer(offer.url, services.data ?? [])
	}));
	rows.sort(
		(a, b) =>
			Number(!a.match) - Number(!b.match) || a.offer.packageName.localeCompare(b.offer.packageName)
	);

	return (
		<>
			<BackLink />

			<div className="mt-6 flex gap-6">
				{title.posterUrl && (
					<img
						src={title.posterUrl}
						alt={mask.title(title.title)}
						className="redact-poster w-32 shrink-0 self-start rounded-lg border border-neutral-200 sm:w-40 dark:border-neutral-800"
					/>
				)}
				<div className="min-w-0">
					<h1 className="text-2xl font-semibold tracking-tight">{mask.title(title.title)}</h1>
					<div className="mt-2 flex flex-wrap items-center gap-1.5">
						<Badge tone="accent">{title.objectType === 'MOVIE' ? 'Movie' : 'Show'}</Badge>
						{title.year && <Badge>{mask.year(title.year)}</Badge>}
						{title.runtime ? <Badge>{mask.minutes(title.runtime)} min</Badge> : null}
						{title.genres.map((g) => (
							<Badge key={g} tone="violet">
								{g}
							</Badge>
						))}
					</div>
					{countries.length > 0 && (
						<div className="mt-3 flex flex-wrap gap-1" aria-label="Available in">
							{countries.map((c) => (
								<button
									key={c}
									onClick={() => setCountry(c)}
									title={`Show availability in ${c}`}
									className={`rounded-md px-1.5 py-0.5 font-mono text-xs font-medium transition-colors ${
										c === country
											? 'bg-accent-600 text-white'
											: 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-100'
									}`}
								>
									{c}
								</button>
							))}
						</div>
					)}
					{title.synopsis && (
						<p className="mt-4 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
							{mask.text(title.synopsis)}
						</p>
					)}
				</div>
			</div>

			<h2 className="mt-8 text-lg font-semibold tracking-tight">Where to watch</h2>
			<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
				Availability in{' '}
				<select
					value={country}
					onChange={(e) => setCountry(e.target.value)}
					aria-label="Region"
					className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-xs font-medium text-neutral-900 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
				>
					{regionOptions.map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</select>
				. Providers matching one of your services link straight to the title.
			</p>

			{offers.length === 0 ? (
				<Card className="mt-4 p-5">
					<p className="text-sm text-neutral-500 dark:text-neutral-400">
						Not available anywhere in {country} right now.
					</p>
				</Card>
			) : (
				<Card className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
					{rows.map(({ offer, match }) => {
						const row = (
							<>
								{offer.iconUrl ? (
									<img
										src={offer.iconUrl}
										alt=""
										className="redact-img h-9 w-9 rounded-lg object-cover"
									/>
								) : (
									<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
										<Icon name="film" size={16} />
									</div>
								)}
								{/* Incognito fakes matched rows from the service tag, so name and badge agree. */}
								<span className="min-w-0 truncate font-medium text-neutral-900 dark:text-neutral-100">
									{incognito && match
										? mask.service(match.service)
										: mask.service(offer.packageName)}
								</span>
								<span className="flex flex-1 flex-wrap gap-1">
									{offer.monetization.map((m) => (
										<Badge key={m} tone={m === 'FLATRATE' ? 'accent' : 'neutral'}>
											{MONETIZATION[m] ?? m.toLowerCase()}
										</Badge>
									))}
								</span>
								{match ? (
									<>
										<Badge tone="green">{mask.service(match.service)}</Badge>
										<Icon
											name="chevron"
											size={18}
											className="shrink-0 text-neutral-300 dark:text-neutral-600"
										/>
									</>
								) : (
									<span className="text-xs text-neutral-400 dark:text-neutral-500">
										no matching service
									</span>
								)}
							</>
						);
						return match ? (
							<Link
								key={offer.packageId}
								to="/title/$service/$id"
								params={{ service: match.service, id: match.id }}
								className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
							>
								{row}
							</Link>
						) : (
							<div key={offer.packageId} className="flex items-center gap-4 px-5 py-3.5 opacity-50">
								{row}
							</div>
						);
					})}
				</Card>
			)}
		</>
	);
}

const MONETIZATION: Record<string, string> = {
	FLATRATE: 'Stream',
	FREE: 'Free',
	ADS: 'Free with ads',
	RENT: 'Rent',
	BUY: 'Buy',
	CINEMA: 'Cinema'
};

function BackLink() {
	return (
		<Link
			to="/"
			className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
		>
			<Icon name="chevron" size={16} className="rotate-180" />
			Browse
		</Link>
	);
}
