<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { api, ApiError, errorMessage } from '$lib/api/client';
	import type { Job } from '$lib/api/types';
	import { isFinished, isQueued, jobView } from '$lib/job';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let jobs = $state<Job[] | null>(null);
	let error = $state<string | null>(null);
	// Action failures live separately so the 2s poll can't wipe them.
	let actionError = $state<string | null>(null);
	let busy = $state<Set<string>>(new Set());
	// Monotonic id so stale poll responses can't overwrite fresher ones.
	let refreshSeq = 0;

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
	let statusFilter = $state<string | null>(null);
	let serviceFilter = $state<string | null>(null);
	let sortBy = $state('created_time');
	let sortOrder = $state<'asc' | 'desc'>('desc');
	// Services seen across polls, so the chip row survives an active service filter.
	let seenServices = $state<string[]>([]);
	const filtering = $derived(statusFilter !== null || serviceFilter !== null);

	function toggleStatus(s: string) {
		statusFilter = statusFilter === s ? null : s;
		refresh();
	}

	function toggleService(s: string) {
		serviceFilter = serviceFilter === s ? null : s;
		refresh();
	}

	function flipOrder() {
		sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
		refresh();
	}

	const clearable = $derived(jobs?.some((j) => isFinished(j.status)) ?? false);
	const queuedCount = $derived(jobs?.filter((j) => isQueued(j.status)).length ?? 0);

	async function clearFinished() {
		actionError = null;
		try {
			await api.clearFinishedJobs();
		} catch (e) {
			actionError = errorMessage(e);
		}
		await refresh();
	}

	async function refresh() {
		const seq = ++refreshSeq;
		try {
			const list = await api.jobs({
				status: statusFilter ?? undefined,
				service: serviceFilter ?? undefined,
				sort_by: sortBy,
				sort_order: sortOrder,
				full: true
			});
			if (seq !== refreshSeq) return;
			const fresh = list.map((j) => j.service).filter((s): s is string => !!s);
			if (fresh.some((s) => !seenServices.includes(s)))
				seenServices = [...new Set([...seenServices, ...fresh])].sort();
			jobs = list;
			error = null;
		} catch (e) {
			if (seq !== refreshSeq) return;
			error = errorMessage(e);
		}
	}

	// Per-job action wrapper: tracks busy state, treats 409 as a poll race (silent).
	async function act(id: string, fn: () => Promise<unknown>) {
		busy = new Set(busy).add(id);
		actionError = null;
		try {
			await fn();
		} catch (e) {
			if (!(e instanceof ApiError && e.status === 409)) actionError = errorMessage(e);
		} finally {
			const next = new Set(busy);
			next.delete(id);
			busy = next;
		}
		await refresh();
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

	let timer: ReturnType<typeof setInterval>;
	onMount(() => {
		refresh();
		timer = setInterval(refresh, 2000);
	});
	onDestroy(() => clearInterval(timer));
</script>

<div class="flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Downloads</h1>
		<p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
			Live job progress, updated every 2s.
		</p>
	</div>
	<div class="flex items-center gap-2">
		{#if clearable}
			<Button variant="secondary" onclick={clearFinished}>
				<Icon name="trash" size={16} /> Clear finished
			</Button>
		{/if}
		<Button variant="secondary" onclick={refresh}>Refresh</Button>
	</div>
</div>

<div class="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
	<div>
		<p class="text-xs font-medium text-neutral-600 dark:text-neutral-400">
			Status
			{#if statusFilter === null}<span class="font-normal text-neutral-400">· all</span>{/if}
		</p>
		<div class="mt-1.5 flex flex-wrap gap-1.5">
			{#each STATUSES as s (s)}
				<button
					type="button"
					onclick={() => toggleStatus(s)}
					aria-pressed={statusFilter === s}
					class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {statusFilter === s
						? 'bg-accent-600 text-white'
						: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'}"
				>
					{s}
				</button>
			{/each}
		</div>
	</div>
	{#if seenServices.length > 0}
		<div>
			<p class="text-xs font-medium text-neutral-600 dark:text-neutral-400">
				Service
				{#if serviceFilter === null}<span class="font-normal text-neutral-400">· all</span>{/if}
			</p>
			<div class="mt-1.5 flex flex-wrap gap-1.5">
				{#each seenServices as s (s)}
					<button
						type="button"
						onclick={() => toggleService(s)}
						aria-pressed={serviceFilter === s}
						class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {serviceFilter === s
							? 'bg-accent-600 text-white'
							: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'}"
					>
						{s}
					</button>
				{/each}
			</div>
		</div>
	{/if}
	<div class="ml-auto">
		<label for="sortBy" class="text-xs font-medium text-neutral-600 dark:text-neutral-400"
			>Sort</label
		>
		<div class="mt-1.5 flex items-center gap-2">
			<div class="relative">
				<select
					id="sortBy"
					bind:value={sortBy}
					onchange={refresh}
					class="appearance-none rounded-lg border border-neutral-200 bg-white py-2 pr-9 pl-3 text-sm font-medium text-neutral-900 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
				>
					{#each SORT_FIELDS as f (f.value)}
						<option value={f.value}>{f.label}</option>
					{/each}
				</select>
				<div
					class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-neutral-400"
				>
					<Icon name="chevron" size={16} class="rotate-90" />
				</div>
			</div>
			<button
				type="button"
				onclick={flipOrder}
				title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
				class="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
			>
				<Icon name="chevron" size={14} class={sortOrder === 'desc' ? 'rotate-90' : '-rotate-90'} />
				{sortOrder}
			</button>
		</div>
	</div>
</div>

{#if error || actionError}
	<Card class="mt-6 p-4">
		<div class="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
			<Icon name="alert" size={16} class="mt-0.5" />
			<span>{error ?? actionError}</span>
		</div>
	</Card>
{/if}

{#if jobs === null && !error}
	<Card class="mt-6 p-8">
		<div class="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
			<Icon name="loader" spin /> Loading jobs…
		</div>
	</Card>
{:else if jobs && jobs.length === 0}
	<Card class="mt-6">
		<EmptyState
			icon="download"
			title={filtering ? 'No matching jobs' : 'No downloads yet'}
			description={filtering
				? 'No jobs match the active filters.'
				: "Start one from a title's detail page."}
		/>
	</Card>
{:else if jobs}
	<div class="mt-6 space-y-3">
		{#each jobs as j (j.job_id)}
			{@const v = jobView(j)}
			<Card class="p-4">
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<Badge tone={v.tone}>{v.statusLabel}</Badge>
							<span class="truncate font-medium text-neutral-900 dark:text-neutral-100"
								>{v.label}</span
							>
						</div>
						<p class="mt-0.5 truncate font-mono text-xs text-neutral-400 dark:text-neutral-500">
							{j.job_id}{#if j.service}{' · '}{j.service}{/if}
						</p>
						{#if v.error}
							<p class="mt-1 text-sm text-red-600 dark:text-red-400">
								{v.error}
							</p>
						{:else if v.done}
							<p class="mt-1 text-sm text-green-600 dark:text-green-400">
								{v.doneLabel}
							</p>
						{:else if v.message}
							<p class="mt-1 text-sm text-neutral-600 capitalize dark:text-neutral-300">
								{v.message}
							</p>
						{/if}
					</div>
					<div class="flex shrink-0 items-center gap-2">
						{#if v.active}
							{#if v.queued && queuedCount > 1}
								<Button
									variant="secondary"
									title="Move to front of queue"
									onclick={() => moveToFront(j.job_id)}
									disabled={busy.has(j.job_id)}
								>
									<Icon name="arrow-up" size={16} /> Move to front
								</Button>
							{/if}
							<Button
								variant="danger"
								onclick={() => cancel(j.job_id)}
								disabled={busy.has(j.job_id)}
							>
								{#if busy.has(j.job_id)}<Icon name="loader" spin />{:else}<Icon
										name="x"
										size={16}
									/>{/if}
								Cancel
							</Button>
						{:else}
							{#if v.retryable}
								<Button
									variant="secondary"
									onclick={() => retry(j.job_id)}
									disabled={busy.has(j.job_id)}
								>
									{#if busy.has(j.job_id)}<Icon name="loader" spin />{:else}<Icon
											name="retry"
											size={16}
										/>{/if}
									Retry
								</Button>
							{/if}
							<Button
								variant="secondary"
								title="Remove job"
								aria-label="Remove job"
								onclick={() => remove(j.job_id)}
								disabled={busy.has(j.job_id)}
							>
								<Icon name="x" size={16} />
							</Button>
						{/if}
					</div>
				</div>

				{#if v.tone === 'red' && (j.error_code || j.error_details || j.worker_stderr)}
					<details
						class="mt-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10"
					>
						<summary
							class="cursor-pointer px-3 py-2 text-sm font-medium text-red-700 select-none dark:text-red-300"
						>
							Error details{#if j.error_code}
								<span class="ml-1 font-mono text-xs font-normal">{j.error_code}</span>{/if}
						</summary>
						<div class="space-y-2 px-3 pb-3">
							{#if j.error_details}
								<p class="text-sm break-words whitespace-pre-wrap text-red-700 dark:text-red-300">
									{j.error_details}
								</p>
							{/if}
							{#if j.worker_stderr}
								<details>
									<summary
										class="cursor-pointer text-xs font-medium text-red-600 select-none dark:text-red-400"
									>
										Worker stderr
									</summary>
									<pre
										class="mt-1 max-h-48 overflow-auto rounded-md bg-red-100/70 p-2 font-mono text-xs whitespace-pre-wrap text-red-800 dark:bg-red-950/40 dark:text-red-200">{j.worker_stderr}</pre>
								</details>
							{/if}
						</div>
					</details>
				{/if}

				{#if v.tone === 'green' && (j.skipped_subtitles?.length ?? 0) > 0}
					{@const langs = [...new Set((j.skipped_subtitles ?? []).map((s) => s.language))]}
					<p class="mt-2 text-xs text-amber-600 dark:text-amber-400">
						{j.skipped_subtitles?.length}
						{j.skipped_subtitles?.length === 1 ? 'subtitle' : 'subtitles'} skipped · {langs.join(
							', '
						)}
					</p>
				{/if}

				{#if v.active}
					{@const muxing = v.progress?.muxing ?? false}
					{@const determinate = v.progress?.determinate ?? false}
					<div class="mt-3">
						<div class="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
							<div
								class="h-full rounded-full bg-accent-500 {determinate
									? 'transition-all duration-500'
									: 'w-1/3'}"
								class:indeterminate={!determinate}
								style={determinate ? `width: ${v.progress?.percent ?? 0}%` : ''}
							></div>
						</div>
						<div class="mt-1 flex justify-between text-xs text-neutral-400 dark:text-neutral-500">
							<span
								>{muxing
									? 'muxing…'
									: determinate
										? `${Math.round(v.progress?.percent ?? 0)}%`
										: 'working…'}</span
							>
							<span>
								{#if typeof j.total_tracks === 'number' && j.total_tracks > 0}
									{j.completed_tracks ?? 0}/{j.total_tracks} tracks
								{/if}
								{#if j.speed}· {j.speed}{/if}
							</span>
						</div>
						{#if v.active && (j.track_progress?.length ?? 0) > 1}
							<div class="mt-2 space-y-1">
								{#each j.track_progress ?? [] as t}
									<div
										class="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500"
									>
										<span class="w-40 truncate">{t.label}</span>
										<div
											class="h-1 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
										>
											<div
												class="h-full rounded-full bg-accent-400 transition-all duration-500"
												style={`width: ${Math.max(0, Math.min(100, t.progress))}%`}
											></div>
										</div>
										<span class="w-9 text-right">{Math.round(t.progress)}%</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				{#if v.episodes}
					{@const ep = v.episodes}
					<div class="mt-3">
						<div class="mb-1.5 flex justify-between text-xs text-neutral-400 dark:text-neutral-500">
							<span>{ep.done.size}/{ep.wanted.length} episodes done</span>
							{#if v.current}
								<span class="text-accent-600 dark:text-accent-400"
									>{v.keysOnly ? 'keys' : 'downloading'} {v.current}</span
								>
							{/if}
						</div>
						<div class="flex flex-wrap gap-1">
							{#each ep.wanted as code (code)}
								<span
									class="rounded px-1.5 py-0.5 font-mono text-[11px] {ep.done.has(code)
										? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
										: code === v.current
											? 'animate-pulse bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-400'
											: 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'}"
								>
									{code}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			</Card>
		{/each}
	</div>
{/if}

<style>
	.indeterminate {
		animation: slide 1.2s ease-in-out infinite;
	}
	@keyframes slide {
		from {
			margin-left: -34%;
		}
		to {
			margin-left: 100%;
		}
	}
</style>
