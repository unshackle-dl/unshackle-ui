import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import Card from '$lib/components/Card';
import EmptyState from '$lib/components/EmptyState';
import Icon from '$lib/components/Icon';
import PosterGrid from '$lib/components/PosterGrid';
import { useSettings } from '$lib/config';
import { popularListQuery } from '$lib/queries';
import { useMask } from '$lib/stores/incognito';
import { trackingErrorMessage } from '$lib/tracking/client';

export const Route = createFileRoute('/popular/$type')({ component: PopularPage });

function PopularPage() {
	const mask = useMask();
	const { type } = Route.useParams();
	const { country } = useSettings();
	const kind = type === 'movies' ? 'movies' : type === 'tv' ? 'tv' : null;

	const list = useQuery({ ...popularListQuery(kind ?? 'movies', country), enabled: kind !== null });

	if (!kind)
		return (
			<Card className="mt-6">
				<EmptyState
					icon="film"
					title="Not found"
					description="Try /popular/movies or /popular/tv."
				/>
			</Card>
		);

	return (
		<>
			<Link
				to="/"
				className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
			>
				<Icon name="chevron" size={16} className="rotate-180" />
				Browse
			</Link>

			<h1 className="mt-4 text-2xl font-semibold tracking-tight">
				{kind === 'movies' ? 'Popular movies' : 'Popular TV'}
			</h1>
			<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
				What's popular on JustWatch in {country} right now.
			</p>

			<div className="mt-6">
				{list.error ? (
					<Card className="p-4">
						<div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
							<Icon name="alert" size={16} className="mt-0.5" />
							<span>{mask.text(trackingErrorMessage(list.error))}</span>
						</div>
					</Card>
				) : list.data ? (
					<PosterGrid titles={list.data.results} />
				) : (
					<div className="mt-10 flex justify-center text-neutral-400">
						<Icon name="loader" size={24} spin />
					</div>
				)}
			</div>
		</>
	);
}
