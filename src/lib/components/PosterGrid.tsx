import { Link } from '@tanstack/react-router';
import type { BrowseTitle } from '$lib/browse/types';
import { useMask } from '$lib/stores/incognito';
import Badge from './Badge';
import Icon from './Icon';

/** Grid of JustWatch posters linking into /browse/$id. */
export default function PosterGrid({
	titles,
	showType = false
}: {
	titles: BrowseTitle[];
	showType?: boolean;
}) {
	const mask = useMask();
	return (
		<div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
			{titles.map((t) => (
				<Link key={t.id} to="/browse/$id" params={{ id: t.id }} className="group min-w-0">
					{t.posterUrl ? (
						<img
							src={t.posterUrl}
							alt={mask.title(t.title)}
							loading="lazy"
							className="redact-poster aspect-2/3 w-full rounded-lg border border-neutral-200 object-cover transition-opacity group-hover:opacity-85 dark:border-neutral-800"
						/>
					) : (
						<div className="flex aspect-2/3 w-full items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-300 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-600">
							<Icon name="film" size={28} />
						</div>
					)}
					<div className="mt-1.5 flex items-center gap-1.5">
						<span className="truncate text-sm font-medium text-neutral-900 group-hover:text-accent-600 dark:text-neutral-100 dark:group-hover:text-accent-400">
							{mask.title(t.title)}
						</span>
						{showType && <Badge>{t.objectType === 'MOVIE' ? 'Movie' : 'Show'}</Badge>}
					</div>
					{t.year && (
						<p className="text-xs text-neutral-500 dark:text-neutral-400">{mask.year(t.year)}</p>
					)}
				</Link>
			))}
		</div>
	);
}
