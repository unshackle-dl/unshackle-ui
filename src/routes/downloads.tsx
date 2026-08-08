import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { api, ApiError, errorMessage } from '$lib/api/client';
import Badge from '$lib/components/Badge';
import Button from '$lib/components/Button';
import Card from '$lib/components/Card';
import EmptyState from '$lib/components/EmptyState';
import Icon from '$lib/components/Icon';
import { isFinished, isQueued, jobView } from '$lib/job';
import { useMask } from '$lib/stores/incognito';

export const Route = createFileRoute('/downloads')({ component: Downloads });

// Server-side filters/sort, passed straight through to GET /api/download/jobs.
const STATUSES = ['queued', 'downloading', 'completed', 'failed', 'cancelled'];
const SORT_FIELDS = [
	{ value: 'created_time', label: 'Created' },
	{ value: 'started_time', label: 'Started' },
	{ value: 'completed_time', label: 'Completed' },
	{ value: 'progress', label: 'Progress' },
	{ value: 'status', label: 'Status' },
	{ value: 'service', label: 'Service' }
];

function Downloads() {
	const mask = useMask();

	const [statusFilter, setStatusFilter] = useState<string | null>(null);
	const [serviceFilter, setServiceFilter] = useState<string | null>(null);
	const [sortBy, setSortBy] = useState('created_time');
	const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
	const filtering = statusFilter !== null || serviceFilter !== null;

	// Action failures live separately so the 2s poll can't wipe them.
	const [actionError, setActionError] = useState<string | null>(null);
	const [busy, setBusy] = useState<Set<string>>(new Set());

	// The filters are part of the key, so changing one refetches on its own, and a
	// slow response for a dropped key can never overwrite the current one.
	const query = useQuery({
		queryKey: ['jobs', statusFilter, serviceFilter, sortBy, sortOrder],
		queryFn: () =>
			api.jobs({
				status: statusFilter ?? undefined,
				service: serviceFilter ?? undefined,
				sort_by: sortBy,
				sort_order: sortOrder,
				full: true
			}),
		refetchInterval: 2000,
		placeholderData: (prev) => prev
	});
	const jobs = query.data ?? null;
	const error = query.error ? errorMessage(query.error) : null;

	// Services seen across polls, so the chip row survives an active service filter.
	const [seenServices, setSeenServices] = useState<string[]>([]);
	useEffect(() => {
		const fresh = (jobs ?? []).map((j) => j.service).filter((s): s is string => !!s);
		setSeenServices((prev) =>
			fresh.some((s) => !prev.includes(s)) ? [...new Set([...prev, ...fresh])].sort() : prev
		);
	}, [jobs]);

	const clearable = jobs?.some((j) => isFinished(j.status)) ?? false;
	const queuedCount = jobs?.filter((j) => isQueued(j.status)).length ?? 0;

	async function clearFinished() {
		setActionError(null);
		try {
			await api.clearFinishedJobs();
		} catch (e) {
			setActionError(errorMessage(e));
		}
		await query.refetch();
	}

	// Per-job action wrapper: tracks busy state, treats 409 as a poll race (silent).
	async function act(id: string, fn: () => Promise<unknown>) {
		setBusy((b) => new Set(b).add(id));
		setActionError(null);
		try {
			await fn();
		} catch (e) {
			if (!(e instanceof ApiError && e.status === 409)) setActionError(errorMessage(e));
		} finally {
			setBusy((b) => {
				const next = new Set(b);
				next.delete(id);
				return next;
			});
		}
		await query.refetch();
	}

	// Re-check status first: DELETE on a just-finished job would remove it, not cancel it.
	const cancel = (id: string) =>
		act(id, async () => {
			const fresh = await api.job(id);
			if (isFinished(fresh.status)) return;
			await api.cancelJob(id);
		});
	const remove = (id: string) => act(id, () => api.cancelJob(id));
	const retry = (id: string) => act(id, () => api.retryJob(id));
	const moveToFront = (id: string) => act(id, () => api.prioritizeJob(id));

	const chip = (on: boolean) =>
		`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
			on
				? 'bg-accent-600 text-white'
				: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
		}`;

	return (
		<>
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Downloads</h1>
					<p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
						Live job progress, updated every 2s.
					</p>
				</div>
				<div className="flex items-center gap-2">
					{clearable && (
						<Button variant="secondary" onClick={clearFinished}>
							<Icon name="trash" size={16} /> Clear finished
						</Button>
					)}
					<Button variant="secondary" onClick={() => query.refetch()}>
						Refresh
					</Button>
				</div>
			</div>

			<div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
				<div>
					<p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
						Status{' '}
						{statusFilter === null && <span className="font-normal text-neutral-400">· all</span>}
					</p>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{STATUSES.map((s) => (
							<button
								key={s}
								type="button"
								onClick={() => setStatusFilter((f) => (f === s ? null : s))}
								aria-pressed={statusFilter === s}
								className={chip(statusFilter === s)}
							>
								{s}
							</button>
						))}
					</div>
				</div>
				{seenServices.length > 0 && (
					<div>
						<p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
							Service{' '}
							{serviceFilter === null && (
								<span className="font-normal text-neutral-400">· all</span>
							)}
						</p>
						<div className="mt-1.5 flex flex-wrap gap-1.5">
							{seenServices.map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => setServiceFilter((f) => (f === s ? null : s))}
									aria-pressed={serviceFilter === s}
									className={chip(serviceFilter === s)}
								>
									{mask.service(s)}
								</button>
							))}
						</div>
					</div>
				)}
				<div className="ml-auto">
					<label
						htmlFor="sortBy"
						className="text-xs font-medium text-neutral-600 dark:text-neutral-400"
					>
						Sort
					</label>
					<div className="mt-1.5 flex items-center gap-2">
						<div className="relative">
							<select
								id="sortBy"
								value={sortBy}
								onChange={(e) => setSortBy(e.target.value)}
								className="appearance-none rounded-lg border border-neutral-200 bg-white py-2 pr-9 pl-3 text-sm font-medium text-neutral-900 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
							>
								{SORT_FIELDS.map((f) => (
									<option key={f.value} value={f.value}>
										{f.label}
									</option>
								))}
							</select>
							<div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-neutral-400">
								<Icon name="chevron" size={16} className="rotate-90" />
							</div>
						</div>
						<button
							type="button"
							onClick={() => setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
							title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
							className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
						>
							<Icon
								name="chevron"
								size={14}
								className={sortOrder === 'desc' ? 'rotate-90' : '-rotate-90'}
							/>
							{sortOrder}
						</button>
					</div>
				</div>
			</div>

			{(error || actionError) && (
				<Card className="mt-6 p-4">
					<div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
						<Icon name="alert" size={16} className="mt-0.5" />
						<span>{error ?? actionError}</span>
					</div>
				</Card>
			)}

			{jobs === null && !error ? (
				<Card className="mt-6 p-8">
					<div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
						<Icon name="loader" spin /> Loading jobs…
					</div>
				</Card>
			) : jobs && jobs.length === 0 ? (
				<Card className="mt-6">
					<EmptyState
						icon="download"
						title={filtering ? 'No matching jobs' : 'No downloads yet'}
						description={
							filtering
								? 'No jobs match the active filters.'
								: "Start one from a title's detail page."
						}
					/>
				</Card>
			) : jobs ? (
				<div className="mt-6 space-y-3">
					{jobs.map((j) => {
						const v = jobView(j);
						const isBusy = busy.has(j.job_id);
						const muxing = v.progress?.muxing ?? false;
						const determinate = v.progress?.determinate ?? false;
						const skippedLangs = [...new Set((j.skipped_subtitles ?? []).map((s) => s.language))];
						return (
							<Card key={j.job_id} className="p-4">
								<div className="flex items-start justify-between gap-4">
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<Badge tone={v.tone}>{v.statusLabel}</Badge>
											<span className="truncate font-medium text-neutral-900 dark:text-neutral-100">
												{mask.title(v.label)}
											</span>
										</div>
										<p className="mt-0.5 truncate font-mono text-xs text-neutral-400 dark:text-neutral-500">
											{j.job_id}
											{j.service && ` · ${mask.service(j.service)}`}
										</p>
										{v.error ? (
											<p className="mt-1 text-sm text-red-600 dark:text-red-400">
												{mask.text(v.error)}
											</p>
										) : v.done ? (
											<p className="mt-1 text-sm text-green-600 dark:text-green-400">
												{v.doneLabel}
											</p>
										) : v.message ? (
											<p className="mt-1 text-sm text-neutral-600 capitalize dark:text-neutral-300">
												{v.message}
											</p>
										) : null}
									</div>
									<div className="flex shrink-0 items-center gap-2">
										{v.active ? (
											<>
												{v.queued && queuedCount > 1 && (
													<Button
														variant="secondary"
														title="Move to front of queue"
														onClick={() => moveToFront(j.job_id)}
														disabled={isBusy}
													>
														<Icon name="arrow-up" size={16} /> Move to front
													</Button>
												)}
												<Button variant="danger" onClick={() => cancel(j.job_id)} disabled={isBusy}>
													{isBusy ? <Icon name="loader" spin /> : <Icon name="x" size={16} />}
													Cancel
												</Button>
											</>
										) : (
											<>
												{v.retryable && (
													<Button
														variant="secondary"
														onClick={() => retry(j.job_id)}
														disabled={isBusy}
													>
														{isBusy ? <Icon name="loader" spin /> : <Icon name="retry" size={16} />}
														Retry
													</Button>
												)}
												<Button
													variant="secondary"
													title="Remove job"
													aria-label="Remove job"
													onClick={() => remove(j.job_id)}
													disabled={isBusy}
												>
													<Icon name="x" size={16} />
												</Button>
											</>
										)}
									</div>
								</div>

								{v.tone === 'red' && (j.error_code || j.error_details || j.worker_stderr) && (
									<details className="mt-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10">
										<summary className="cursor-pointer px-3 py-2 text-sm font-medium text-red-700 select-none dark:text-red-300">
											Error details
											{j.error_code && (
												<span className="ml-1 font-mono text-xs font-normal">{j.error_code}</span>
											)}
										</summary>
										<div className="space-y-2 px-3 pb-3">
											{j.error_details && (
												<p className="text-sm break-words whitespace-pre-wrap text-red-700 dark:text-red-300">
													{mask.text(j.error_details)}
												</p>
											)}
											{j.worker_stderr && (
												<details>
													<summary className="cursor-pointer text-xs font-medium text-red-600 select-none dark:text-red-400">
														Worker stderr
													</summary>
													<pre className="mt-1 max-h-48 overflow-auto rounded-md bg-red-100/70 p-2 font-mono text-xs whitespace-pre-wrap text-red-800 dark:bg-red-950/40 dark:text-red-200">
														{mask.text(j.worker_stderr)}
													</pre>
												</details>
											)}
										</div>
									</details>
								)}

								{v.tone === 'green' && (j.skipped_subtitles?.length ?? 0) > 0 && (
									<p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
										{j.skipped_subtitles?.length}{' '}
										{j.skipped_subtitles?.length === 1 ? 'subtitle' : 'subtitles'} skipped ·{' '}
										{skippedLangs.join(', ')}
									</p>
								)}

								{v.active && (
									<div className="mt-3">
										<div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
											<div
												className={`h-full rounded-full bg-accent-500 ${
													determinate ? 'transition-all duration-500' : 'w-1/3 indeterminate'
												}`}
												style={determinate ? { width: `${v.progress?.percent ?? 0}%` } : undefined}
											/>
										</div>
										<div className="mt-1 flex justify-between text-xs text-neutral-400 dark:text-neutral-500">
											<span>
												{muxing
													? 'muxing…'
													: determinate
														? `${Math.round(v.progress?.percent ?? 0)}%`
														: 'working…'}
											</span>
											<span>
												{typeof j.total_tracks === 'number' &&
													j.total_tracks > 0 &&
													`${j.completed_tracks ?? 0}/${j.total_tracks} tracks`}
												{j.speed && ` · ${j.speed}`}
											</span>
										</div>
										{(j.track_progress?.length ?? 0) > 1 && (
											<div className="mt-2 space-y-1">
												{(j.track_progress ?? []).map((t) => (
													<div
														key={t.label}
														className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500"
													>
														<span className="w-40 truncate">{t.label}</span>
														<div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
															<div
																className="h-full rounded-full bg-accent-400 transition-all duration-500"
																style={{ width: `${Math.max(0, Math.min(100, t.progress))}%` }}
															/>
														</div>
														<span className="w-9 text-right">{Math.round(t.progress)}%</span>
													</div>
												))}
											</div>
										)}
									</div>
								)}

								{v.episodes && (
									<div className="mt-3">
										<div className="mb-1.5 flex justify-between text-xs text-neutral-400 dark:text-neutral-500">
											<span>
												{v.episodes.done.size}/{v.episodes.wanted.length} episodes done
											</span>
											{v.current && (
												<span className="text-accent-600 dark:text-accent-400">
													{v.keysOnly ? 'keys' : 'downloading'} {v.current}
												</span>
											)}
										</div>
										<div className="flex flex-wrap gap-1">
											{v.episodes.wanted.map((code) => (
												<span
													key={code}
													className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
														v.episodes!.done.has(code)
															? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
															: code === v.current
																? 'animate-pulse bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-400'
																: 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
													}`}
												>
													{code}
												</span>
											))}
										</div>
									</div>
								)}
							</Card>
						);
					})}
				</div>
			) : null}
		</>
	);
}
