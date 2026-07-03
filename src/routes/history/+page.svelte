<script lang="ts">
	import { onMount } from 'svelte';
	import { api, errorMessage } from '$lib/api/client';
	import type { HistoryEntry } from '$lib/api/types';
	import { isKeysOnly, tone } from '$lib/job';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Icon from '$lib/components/Icon.svelte';

	const PAGE = 100;

	let entries = $state<HistoryEntry[] | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(false);
	let limit = $state(PAGE);
	let serviceFilter = $state<string | null>(null);
	// Services seen across fetches, so the chip row survives an active filter.
	let seenServices = $state<string[]>([]);
	// job_ids whose selection detail is expanded.
	let expanded = $state<Set<string>>(new Set());

	function toggle(id: string) {
		const next = new Set(expanded);
		next.has(id) ? next.delete(id) : next.add(id);
		expanded = next;
	}

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

	async function refresh() {
		loading = true;
		try {
			const res = await api.history({ limit, service: serviceFilter ?? undefined });
			entries = res.history;
			const fresh = res.history.map((e) => e.service).filter(Boolean);
			if (fresh.some((s) => !seenServices.includes(s)))
				seenServices = [...new Set([...seenServices, ...fresh])].sort();
			error = null;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			loading = false;
		}
	}

	onMount(refresh);

	function toggleService(s: string) {
		serviceFilter = serviceFilter === s ? null : s;
		limit = PAGE;
		refresh();
	}

	function loadMore() {
		limit += PAGE;
		refresh();
	}

	let removing = $state<Set<string>>(new Set());
	async function remove(id: string) {
		removing = new Set(removing).add(id);
		try {
			await api.deleteHistory(id);
			entries = entries?.filter((e) => e.job_id !== id) ?? null;
		} catch (e) {
			error = errorMessage(e);
		} finally {
			const next = new Set(removing);
			next.delete(id);
			removing = next;
		}
	}

	// More rows may exist when the server filled the current limit.
	const maybeMore = $derived((entries?.length ?? 0) >= limit);

	function when(e: HistoryEntry): string {
		const t = e.completed_time ?? e.created_time;
		return t ? new Date(t).toLocaleString() : '—';
	}
</script>

{#snippet chipRow(label: string, items: string[])}
	{#if items.length}
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="w-20 shrink-0 text-xs font-medium text-neutral-500">{label}</span>
			{#each items as it (it)}
				<span
					class="rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
				>
					{it}
				</span>
			{/each}
		</div>
	{/if}
{/snippet}

<div class="flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">History</h1>
		<p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
			Finished jobs recorded by the server, newest first.
		</p>
	</div>
	<Button variant="secondary" onclick={refresh} disabled={loading}>
		{#if loading}<Icon name="loader" spin />{/if} Refresh
	</Button>
</div>

{#if seenServices.length > 0}
	<div class="mt-4">
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

{#if error}
	<Card class="mt-6 p-4">
		<div class="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
			<Icon name="alert" size={16} class="mt-0.5" />
			<span>{error}</span>
		</div>
	</Card>
{:else if entries === null}
	<Card class="mt-6 p-8">
		<div class="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
			<Icon name="loader" spin /> Loading history…
		</div>
	</Card>
{:else if entries.length === 0}
	<Card class="mt-6">
		<EmptyState
			icon="history"
			title={serviceFilter ? 'No matching history' : 'No history yet'}
			description={serviceFilter
				? 'No finished jobs for this service.'
				: 'Finished downloads will show up here.'}
		/>
	</Card>
{:else}
	<Card class="mt-6 divide-y divide-neutral-100 dark:divide-neutral-800">
		{#each entries as e (e.job_id)}
			{@const s = selection(e)}
			<div class="px-5 py-3.5">
				<button
					type="button"
					onclick={() => toggle(e.job_id)}
					class="flex w-full items-center justify-between gap-4 text-left"
				>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<Badge tone={tone(e.status)}>{e.status}</Badge>
							<Badge tone={keysOnly(e) ? 'amber' : 'neutral'}>
								{keysOnly(e) ? 'Keys' : 'Download'}
							</Badge>
							<span class="truncate font-medium text-neutral-900 dark:text-neutral-100">
								{e.title || e.title_id}
							</span>
						</div>
						<p class="mt-0.5 truncate font-mono text-xs text-neutral-400 dark:text-neutral-500">
							{e.service} · {e.title_id}
						</p>
						{#if e.error_message}
							<p class="mt-1 truncate text-sm text-red-600 dark:text-red-400">{e.error_message}</p>
						{/if}
					</div>
					<div class="flex shrink-0 items-center gap-3">
						<div class="text-right text-xs text-neutral-400 dark:text-neutral-500">
							<p>{when(e)}</p>
							<p class="mt-0.5">
								{e.output_files.length}
								{e.output_files.length === 1 ? 'file' : 'files'}
							</p>
						</div>
						<Icon
							name="chevron"
							size={16}
							class="text-neutral-300 dark:text-neutral-600 {expanded.has(e.job_id)
								? '-rotate-90'
								: 'rotate-90'}"
						/>
					</div>
				</button>

				{#if expanded.has(e.job_id)}
					<div class="mt-3 space-y-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
						{@render chipRow('Type', [keysOnly(e) ? 'Keys only' : 'Full download'])}
						{@render chipRow('Episodes', s.episodes.length ? s.episodes : ['Movie'])}
						{@render chipRow('Quality', s.quality)}
						{@render chipRow('Codecs', s.codecs)}
						{@render chipRow('Range', s.ranges)}
						{@render chipRow('Audio', s.audio)}
						{@render chipRow('Subtitles', s.subs)}
						<div class="pt-1">
							<Button
								variant="danger"
								onclick={() => remove(e.job_id)}
								disabled={removing.has(e.job_id)}
							>
								{#if removing.has(e.job_id)}<Icon name="loader" spin />{:else}<Icon
										name="trash"
										size={16}
									/>{/if}
								Delete from history
							</Button>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</Card>

	{#if maybeMore}
		<div class="mt-4 flex justify-center">
			<Button variant="secondary" onclick={loadMore} disabled={loading}>
				{#if loading}<Icon name="loader" spin />{/if} Load more
			</Button>
		</div>
	{/if}
{/if}
