import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import Button from '$lib/components/Button';
import Card from '$lib/components/Card';
import EmptyState from '$lib/components/EmptyState';
import Icon from '$lib/components/Icon';
import PosterGrid from '$lib/components/PosterGrid';
import { useSettings } from '$lib/config';
import { browseSearchQuery } from '$lib/queries';
import { useMask } from '$lib/stores/incognito';
import { trackingErrorMessage } from '$lib/tracking/client';

export const Route = createFileRoute('/discover')({ component: Discover });

function Discover() {
	const mask = useMask();
	const { country } = useSettings();
	const [input, setInput] = useState('');
	const [q, setQ] = useState('');

	const search = useQuery({ ...browseSearchQuery(q, country), enabled: q !== '' });
	const results = search.data?.results;

	return (
		<>
			<h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
			<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
				Search JustWatch and see where a title streams in {country}.
			</p>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					setQ(input.trim());
				}}
				className="mt-6 flex gap-3"
			>
				<div className="relative min-w-64 flex-1">
					<div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
						<Icon name="search" size={16} />
					</div>
					<input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						type="search"
						placeholder="Search movies and shows..."
						className="redact w-full rounded-lg border border-neutral-200 bg-white py-2 pr-3 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
					/>
				</div>
				<Button type="submit" disabled={search.isFetching || !input.trim()}>
					{search.isFetching ? (
						<>
							<Icon name="loader" spin />
							Searching...
						</>
					) : (
						'Search'
					)}
				</Button>
			</form>

			<div className="mt-8">
				{search.error ? (
					<Card className="p-4">
						<div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
							<Icon name="alert" size={16} className="mt-0.5" />
							<span>{mask.text(trackingErrorMessage(search.error))}</span>
						</div>
					</Card>
				) : results ? (
					results.length === 0 ? (
						<Card>
							<EmptyState icon="search" title="No results" description="Try a different query." />
						</Card>
					) : (
						<PosterGrid titles={results} showType />
					)
				) : (
					<Card>
						<EmptyState
							icon="search"
							title="Search JustWatch"
							description="Find a title, then see which of your services carry it."
						/>
					</Card>
				)}
			</div>
		</>
	);
}
