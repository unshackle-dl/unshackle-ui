import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '$lib/api/client';
import type { HistoryEntry, HistoryResponse } from '$lib/api/types';
import Badge from '$lib/components/Badge';
import Button from '$lib/components/Button';
import Card from '$lib/components/Card';
import EmptyState from '$lib/components/EmptyState';
import Icon from '$lib/components/Icon';
import { isKeysOnly, tone } from '$lib/job';
import { useMask } from '$lib/stores/incognito';

export const Route = createFileRoute('/history')({ component: History });

const PAGE = 100;

const keysOnly = (e: HistoryEntry) => isKeysOnly(e.parameters);
const toArr = (v: unknown): string[] =>
	Array.isArray(v) ? v.map(String) : v == null || v === '' ? [] : [String(v)];

// The chip-worthy selection this job was started with (redacted params from the server).
function selection(e: HistoryEntry) {
	const p = e.parameters ?? {};
	return {
		episodes: toArr(p.wanted),
		quality: toArr(p.quality).map((q) => `${q}p`),
		codecs: toArr(p.vcodec),
		ranges: toArr(p.range),
		audio: toArr(p.a_lang),
		subs: toArr(p.s_lang)
	};
}

function when(e: HistoryEntry): string {
	const t = e.completed_time ?? e.created_time;
	return t ? new Date(t).toLocaleString() : '—';
}

function ChipRow({ label, items }: { label: string; items: string[] }) {
	if (!items.length) return null;
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="w-20 shrink-0 text-xs font-medium text-neutral-500">{label}</span>
			{items.map((it) => (
				<span
					key={it}
					className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
				>
					{it}
				</span>
			))}
		</div>
	);
}

function History() {
	const mask = useMask();
	const queryClient = useQueryClient();

	const [limit, setLimit] = useState(PAGE);
	const [serviceFilter, setServiceFilter] = useState<string | null>(null);
	// job_ids whose selection detail is expanded.
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [removing, setRemoving] = useState<Set<string>>(new Set());
	// Delete failures need somewhere to go that the query's own error can't hold.
	const [actionError, setActionError] = useState<string | null>(null);

	const queryKey = ['history', limit, serviceFilter] as const;
	const query = useQuery({
		queryKey,
		queryFn: () => api.history({ limit, service: serviceFilter ?? undefined }),
		placeholderData: (prev) => prev
	});
	const entries = query.data?.history ?? null;
	const error = query.error ? errorMessage(query.error) : actionError;
	const loading = query.isFetching;

	// Services seen across fetches, so the chip row survives an active filter.
	const [seenServices, setSeenServices] = useState<string[]>([]);
	useEffect(() => {
		const fresh = (entries ?? []).map((e) => e.service).filter(Boolean);
		setSeenServices((prev) =>
			fresh.some((s) => !prev.includes(s)) ? [...new Set([...prev, ...fresh])].sort() : prev
		);
	}, [entries]);

	const toggle = (id: string) =>
		setExpanded((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});

	const toggleService = (s: string) => {
		setServiceFilter((f) => (f === s ? null : s));
		setLimit(PAGE);
	};

	async function remove(id: string) {
		setRemoving((r) => new Set(r).add(id));
		setActionError(null);
		try {
			await api.deleteHistory(id);
			queryClient.setQueryData<HistoryResponse>(queryKey, (old) =>
				old ? { ...old, history: old.history.filter((e) => e.job_id !== id) } : old
			);
		} catch (e) {
			setActionError(errorMessage(e));
		} finally {
			setRemoving((r) => {
				const next = new Set(r);
				next.delete(id);
				return next;
			});
		}
	}

	// More rows may exist when the server filled the current limit.
	const maybeMore = (entries?.length ?? 0) >= limit;

	return (
		<>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">History</h1>
					<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
						Finished jobs recorded by the server, newest first.
					</p>
				</div>
				<Button variant="secondary" onClick={() => query.refetch()} disabled={loading}>
					{loading && <Icon name="loader" spin />} Refresh
				</Button>
			</div>

			{seenServices.length > 0 && (
				<div className="mt-4">
					<p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
						Service{' '}
						{serviceFilter === null && <span className="font-normal text-neutral-400">· all</span>}
					</p>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{seenServices.map((s) => (
							<button
								key={s}
								type="button"
								onClick={() => toggleService(s)}
								aria-pressed={serviceFilter === s}
								className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
									serviceFilter === s
										? 'bg-accent-600 text-white'
										: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
								}`}
							>
								{mask.service(s)}
							</button>
						))}
					</div>
				</div>
			)}

			{error ? (
				<Card className="mt-6 p-4">
					<div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
						<Icon name="alert" size={16} className="mt-0.5" />
						<span>{error}</span>
					</div>
				</Card>
			) : entries === null ? (
				<Card className="mt-6 p-8">
					<div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
						<Icon name="loader" spin /> Loading history…
					</div>
				</Card>
			) : entries.length === 0 ? (
				<Card className="mt-6">
					<EmptyState
						icon="history"
						title={serviceFilter ? 'No matching history' : 'No history yet'}
						description={
							serviceFilter
								? 'No finished jobs for this service.'
								: 'Finished downloads will show up here.'
						}
					/>
				</Card>
			) : (
				<>
					<Card className="mt-6 divide-y divide-neutral-100 dark:divide-neutral-800">
						{entries.map((e) => {
							const s = selection(e);
							const isOpen = expanded.has(e.job_id);
							return (
								<div key={e.job_id} className="px-5 py-3.5">
									<button
										type="button"
										onClick={() => toggle(e.job_id)}
										className="flex w-full items-center justify-between gap-4 text-left"
									>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<Badge tone={tone(e.status)}>{e.status}</Badge>
												<Badge tone={keysOnly(e) ? 'amber' : 'neutral'}>
													{keysOnly(e) ? 'Keys' : 'Download'}
												</Badge>
												<span className="truncate font-medium text-neutral-900 dark:text-neutral-100">
													{mask.title(e.title || e.title_id)}
												</span>
											</div>
											<p className="mt-0.5 truncate font-mono text-xs text-neutral-400 dark:text-neutral-500">
												{mask.service(e.service)} · {mask.id(e.title_id)}
											</p>
											{e.error_message && (
												<p className="mt-1 truncate text-sm text-red-600 dark:text-red-400">
													{mask.text(e.error_message)}
												</p>
											)}
										</div>
										<div className="flex shrink-0 items-center gap-3">
											<div className="text-right text-xs text-neutral-400 dark:text-neutral-500">
												<p>{when(e)}</p>
												<p className="mt-0.5">
													{e.output_files.length} {e.output_files.length === 1 ? 'file' : 'files'}
												</p>
											</div>
											<Icon
												name="chevron"
												size={16}
												className={`text-neutral-300 dark:text-neutral-600 ${
													isOpen ? '-rotate-90' : 'rotate-90'
												}`}
											/>
										</div>
									</button>

									{isOpen && (
										<div className="mt-3 space-y-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
											<ChipRow label="Type" items={[keysOnly(e) ? 'Keys only' : 'Full download']} />
											<ChipRow
												label="Episodes"
												items={s.episodes.length ? s.episodes : ['Movie']}
											/>
											<ChipRow label="Quality" items={s.quality} />
											<ChipRow label="Codecs" items={s.codecs} />
											<ChipRow label="Range" items={s.ranges} />
											<ChipRow label="Audio" items={s.audio} />
											<ChipRow label="Subtitles" items={s.subs} />
											<div className="pt-1">
												<Button
													variant="danger"
													onClick={() => remove(e.job_id)}
													disabled={removing.has(e.job_id)}
												>
													{removing.has(e.job_id) ? (
														<Icon name="loader" spin />
													) : (
														<Icon name="trash" size={16} />
													)}
													Delete from history
												</Button>
											</div>
										</div>
									)}
								</div>
							);
						})}
					</Card>

					{maybeMore && (
						<div className="mt-4 flex justify-center">
							<Button
								variant="secondary"
								onClick={() => setLimit((l) => l + PAGE)}
								disabled={loading}
							>
								{loading && <Icon name="loader" spin />} Load more
							</Button>
						</div>
					)}
				</>
			)}
		</>
	);
}
