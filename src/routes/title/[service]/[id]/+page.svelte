<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, errorMessage } from '$lib/api/client';
	import type { Title, Tracks } from '$lib/api/types';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import ChipSelect from '$lib/components/ChipSelect.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import OptionForm from '$lib/components/OptionForm.svelte';
	import { ADVANCED_FIELDS, blankAdvanced, buildDownloadRequest } from '$lib/download';
	import { blankValues, serviceFields, type Field } from '$lib/options';
	import { getProfiles } from '$lib/profiles';
	import { isEpisodic, summarize, type TrackSummary, wantedCode } from '$lib/tracks';

	let { data } = $props();

	const episodic = untrack(() => isEpisodic(data.titles));
	const first = untrack(() => data.titles[0]);
	const header = first?.series_title || first?.name || 'Title';

	// Episodes picked for download (empty = all episodes). Movies stay empty.
	let epSel = $state<string[]>([]);

	interface EpisodeTracks {
		code: string | null;
		title: Title;
		tracks: Tracks;
	}
	let trackResults = $state<EpisodeTracks[]>([]);
	let tracksLoading = $state(false);
	let tracksError = $state<string | null>(null);
	let loadedSel = $state(''); // snapshot of epSel at last load, to flag staleness

	// Codecs to request. Fixed list, not derived from tracks: some services (e.g. AMZN)
	// only serve a codec when it's explicitly requested, so all must be selectable.
	const CODECS = ['H.264', 'H.265', 'VP9', 'AV1'];
	// Fixed list like CODECS: manifests don't always advertise every range the service can serve.
	const RANGES = ['SDR', 'HLG', 'HDR10', 'HDR10P', 'DV', 'HYBRID'];

	// Download config. Each is a multi-select; empty means "include all / any".
	let qualitySel = $state<string[]>([]);
	let codecSel = $state<string[]>([]);
	let rangeSel = $state<string[]>([]);
	let audioSel = $state<string[]>([]);
	let subSel = $state<string[]>([]);
	let advanced = $state(
		untrack(() => ({
			...blankAdvanced(),
			profile: data.profile,
			proxy: data.proxy,
			no_proxy: data.noProxy
		}))
	);
	let starting = $state(false);
	let startError = $state<string | null>(null);

	// Named profiles for this service; null keeps the free-text advanced field.
	let profileOptions = $state<string[] | null>(null);
	onMount(async () => {
		const profiles = await getProfiles();
		if (!profiles) return;
		profileOptions = profiles[data.service] ?? [];
		// Drop a stale profile the service doesn't have.
		if (!profileOptions.includes(String(advanced.profile))) advanced.profile = '';
	});

	// This service's own cli options (region, cdn, bitrate mode, …), if it has any.
	let svcFields = $state<Field[]>([]);
	let svcValues = $state<Record<string, string | boolean>>({});
	onMount(async () => {
		try {
			const services = await api.services();
			svcFields = serviceFields(services.find((s) => s.tag === data.service)?.cli_params);
			svcValues = blankValues(svcFields);
		} catch {
			// section simply stays hidden
		}
	});

	// Advanced fields, with the free-text `profile` swapped for a picker when the
	// service has named profiles (null = fetch failed → keep free text; [] = none → hide).
	const advancedFields = $derived.by<Field[]>(() => {
		const opts = profileOptions;
		if (opts === null) return ADVANCED_FIELDS;
		if (opts.length === 0) return ADVANCED_FIELDS.filter((f) => f.key !== 'profile');
		return ADVANCED_FIELDS.map((f) =>
			f.key === 'profile' ? { ...f, type: 'choice' as const, choices: opts } : f
		);
	});

	const episodeOptions = $derived(
		data.titles
			.map((t) => wantedCode(t))
			.filter((c): c is string => c != null)
			// New line at each season boundary (codes are SxxEyy; slice(0,3) = season).
			.map((c, i, all) => ({
				value: c,
				label: c,
				breakBefore: i > 0 && c.slice(0, 3) !== all[i - 1].slice(0, 3)
			}))
	);

	// Per-episode summaries shown in "Available tracks".
	const episodeSummaries = $derived(
		trackResults.map((r) => ({ code: r.code, name: r.title.name, summary: summarize(r.tracks) }))
	);

	// Combined option pool across all loaded episodes drives the download chips.
	const combined = $derived.by<TrackSummary | null>(() => {
		if (!trackResults.length) return null;
		const merged: Tracks = {
			title: trackResults[0].tracks.title,
			video: trackResults.flatMap((r) => r.tracks.video),
			audio: trackResults.flatMap((r) => r.tracks.audio),
			subtitles: trackResults.flatMap((r) => r.tracks.subtitles)
		};
		return summarize(merged);
	});

	const stale = $derived(JSON.stringify(epSel) !== loadedSel);

	// Manual: load tracks for the selected episodes (or the first episode / movie
	// when nothing is selected). Episode selection alone never triggers this.
	async function loadSelection() {
		tracksLoading = true;
		tracksError = null;
		startError = null;
		const targets: Title[] = episodic
			? epSel.length
				? data.titles.filter((t) => {
						const c = wantedCode(t);
						return c != null && epSel.includes(c);
					})
				: [first]
			: [first];
		try {
			const results = await Promise.all(
				targets.map(async (t) => ({
					code: wantedCode(t),
					title: t,
					tracks: await api.listTracks({
						service: data.service,
						title_id: data.titleId,
						wanted: wantedCode(t) ?? undefined,
						profile: String(advanced.profile).trim() || undefined,
						proxy: String(advanced.proxy).trim() || undefined,
						no_proxy: advanced.no_proxy === true || undefined
					})
				}))
			);
			trackResults = results;
			loadedSel = JSON.stringify(epSel);
			qualitySel = [];
			codecSel = [];
			rangeSel = [];
			audioSel = [];
			subSel = [];
		} catch (e) {
			tracksError = errorMessage(e);
			trackResults = [];
		} finally {
			tracksLoading = false;
		}
	}

	onMount(loadSelection);

	async function startDownload() {
		starting = true;
		startError = null;
		try {
			await api.download(
				buildDownloadRequest(
					{ service: data.service, title_id: data.titleId },
					{
						// An empty selection means all episodes; send them so progress can list them.
						wanted: epSel.length ? epSel : episodeOptions.map((o) => o.value),
						quality: qualitySel,
						vcodec: codecSel,
						range: rangeSel,
						a_lang: audioSel,
						s_lang: subSel
					},
					advanced,
					svcFields,
					svcValues
				)
			);
			await goto('/downloads');
		} catch (e) {
			startError = errorMessage(e);
			starting = false;
		}
	}
</script>

<a
	href="/"
	class="inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
>
	<Icon name="chevron" size={16} class="rotate-180" /> Back to search
</a>

<div class="mt-3 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-semibold tracking-tight">{header}</h1>
	{#if first?.type}<Badge tone="accent">{episodic ? 'series' : first.type}</Badge>{/if}
	{#if first?.year}<span class="text-sm text-neutral-500 dark:text-neutral-400">{first.year}</span
		>{/if}
</div>
<p class="mt-1 font-mono text-xs text-neutral-400 dark:text-neutral-500">
	{data.service} · {data.titleId}
</p>

{#if data.error}
	<Card class="mt-6 p-4">
		<div class="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
			<Icon name="alert" size={16} class="mt-0.5" />
			<span>{data.error}</span>
		</div>
	</Card>
{:else}
	<!-- Row 1: Episodes + Available tracks side by side -->
	<div class="mt-6 grid gap-6 {episodic && episodeOptions.length > 0 ? 'lg:grid-cols-2' : ''}">
		{#if episodic && episodeOptions.length > 0}
			<Card class="p-5">
				<div class="flex items-center justify-between gap-3">
					<p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
						Episodes
						{#if epSel.length === 0}
							<span class="font-normal text-neutral-400"
								>· all {episodeOptions.length} episodes</span
							>
						{:else}
							<span class="font-normal text-neutral-400">· {epSel.length} selected</span>
						{/if}
					</p>
					<div class="flex items-center gap-3 text-xs">
						<button
							type="button"
							onclick={loadSelection}
							disabled={tracksLoading}
							class="inline-flex items-center gap-1 font-medium disabled:opacity-50 {stale
								? 'text-accent-600 dark:text-accent-400'
								: 'text-neutral-500 dark:text-neutral-400'} hover:underline"
						>
							<Icon name="loader" size={13} spin={tracksLoading} />
							Refresh selection
						</button>
						<button
							type="button"
							onclick={() => (epSel = episodeOptions.map((o) => o.value))}
							class="font-medium text-accent-600 hover:underline dark:text-accent-400"
							>Select all</button
						>
						<button
							type="button"
							onclick={() => (epSel = [])}
							class="font-medium text-neutral-500 hover:underline dark:text-neutral-400"
							>Clear</button
						>
					</div>
				</div>
				<div class="mt-3">
					<ChipSelect label="" bind:selected={epSel} options={episodeOptions} />
				</div>
				{#if stale && !tracksLoading}
					<p class="mt-2 text-xs text-accent-600 dark:text-accent-400">
						Selection changed. Click "Refresh selection" to update available tracks.
					</p>
				{/if}
			</Card>
		{/if}

		<!-- Available tracks (per selected episode) -->
		<Card class="p-5">
			<div class="flex items-center justify-between">
				<h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
					Available tracks
				</h2>
				{#if episodic && trackResults.length > 0}
					<span class="text-xs text-neutral-400">
						{trackResults.length}
						{trackResults.length === 1 ? 'episode' : 'episodes'}
					</span>
				{/if}
			</div>
			{#if tracksLoading}
				<div class="flex items-center gap-2 py-8 text-sm text-neutral-500 dark:text-neutral-400">
					<Icon name="loader" spin /> Loading tracks…
				</div>
			{:else if tracksError}
				<div class="flex items-start gap-2 py-4 text-sm text-red-600 dark:text-red-400">
					<Icon name="alert" size={16} class="mt-0.5" />
					<span>{tracksError}</span>
				</div>
			{:else if episodeSummaries.length > 0}
				<div class="mt-3 max-h-96 space-y-4 overflow-y-auto pr-1">
					{#each episodeSummaries as e (e.code ?? e.name)}
						{@const s = e.summary}
						<div
							class="border-t border-neutral-100 pt-3 first:border-0 first:pt-0 dark:border-neutral-800"
						>
							{#if e.code}
								<p class="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
									{e.code} · {e.name}
								</p>
							{/if}
							<dl class="mt-1.5 space-y-2 text-sm">
								<div class="flex flex-wrap items-center gap-1.5">
									<dt class="w-16 shrink-0 text-xs font-medium text-neutral-500">Video</dt>
									{#each s.heights as h (h)}<Badge>{h}p</Badge>{/each}
									{#each s.ranges as r (r)}<Badge tone="violet">{r}</Badge>{/each}
									{#each s.vcodecs as c (c)}<Badge tone="neutral">{c}</Badge>{/each}
								</div>
								<div class="flex flex-wrap items-center gap-1.5">
									<dt class="w-16 shrink-0 text-xs font-medium text-neutral-500">Audio</dt>
									<Badge tone="accent">{s.audioLangs.length} langs</Badge>
									{#each s.audioCodecs as c (c)}<Badge>{c}</Badge>{/each}
									{#if s.atmos}<Badge tone="amber">Atmos</Badge>{/if}
								</div>
								<div class="flex flex-wrap items-center gap-1.5">
									<dt class="w-16 shrink-0 text-xs font-medium text-neutral-500">Subs</dt>
									<Badge tone="accent">{s.subLangs.length} langs</Badge>
								</div>
							</dl>
						</div>
					{/each}
				</div>
			{:else}
				<p class="py-6 text-sm text-neutral-400 dark:text-neutral-500">
					No tracks loaded. Pick episodes and click "Refresh selection".
				</p>
			{/if}
		</Card>
	</div>

	<!-- Row 2: Download (full width) -->
	<Card class="mt-6 p-5">
		<h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Download</h2>
		<p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
			Click to pick tracks. Leave a row empty to include all.
		</p>
		{#if combined}
			<div class="mt-4 space-y-4">
				<div class="grid gap-4 sm:grid-cols-2">
					<ChipSelect
						label="Quality"
						emptyHint="best available"
						bind:selected={qualitySel}
						options={combined.heights.map((h) => ({ value: String(h), label: `${h}p` }))}
					/>
					<ChipSelect
						label="Video codecs"
						emptyHint="any"
						bind:selected={codecSel}
						options={CODECS.map((c) => ({ value: c, label: c }))}
					/>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<ChipSelect
						label="Range"
						emptyHint="any"
						bind:selected={rangeSel}
						options={RANGES.map((r) => ({ value: r, label: r }))}
					/>
					{#if combined.audioLangs.length > 0}
						<ChipSelect
							label="Audio languages"
							emptyHint="all"
							bind:selected={audioSel}
							options={combined.audioLangs.map((l) => ({ value: l, label: l }))}
						/>
					{/if}
				</div>
				{#if combined.subLangs.length > 0}
					<ChipSelect
						label="Subtitle languages"
						emptyHint="all"
						bind:selected={subSel}
						options={combined.subLangs.map((l) => ({ value: l, label: l }))}
					/>
				{/if}

				{#if svcFields.length > 0}
					<OptionForm title="{data.service} options" fields={svcFields} bind:values={svcValues} />
				{/if}

				<OptionForm title="Advanced options" fields={advancedFields} bind:values={advanced} />

				<Button
					onclick={startDownload}
					disabled={starting || tracksLoading || !!tracksError}
					class="w-full sm:w-auto"
				>
					{#if starting}<Icon name="loader" spin />Starting…{:else}<Icon name="download" />Start
						download{/if}
				</Button>
			</div>
		{:else}
			<div class="mt-4 flex items-center gap-2 py-4 text-sm text-neutral-400 dark:text-neutral-500">
				{#if tracksLoading}<Icon name="loader" spin /> Loading tracks…{:else}Select an episode to
					load tracks.{/if}
			</div>
		{/if}

		{#if startError}
			<div class="mt-4 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
				<Icon name="alert" size={16} class="mt-0.5" />
				<span>{startError}</span>
			</div>
		{/if}
	</Card>
{/if}
