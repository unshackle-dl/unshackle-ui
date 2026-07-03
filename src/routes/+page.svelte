<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { navigating } from '$app/state';
	import { goto } from '$app/navigation';
	import { api, errorMessage } from '$lib/api/client';
	import type { SearchResult } from '$lib/api/types';
	import { getProfiles } from '$lib/profiles';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let { data } = $props();

	let service = $state(
		untrack(() => data.services.find((s) => s.tag === 'ATV')?.tag ?? data.services[0]?.tag ?? '')
	);
	let query = $state('');
	let results = $state<SearchResult[] | null>(null);
	let loading = $state(false);
	let opening = $state(false);
	let error = $state<string | null>(null);

	// Named credential profiles per service; only shown for services that have them.
	let profiles = $state<Record<string, string[]> | null>(null);
	let profile = $state('');
	onMount(async () => {
		profiles = await getProfiles();
	});
	const profileOptions = $derived(profiles?.[service] ?? []);
	// Preselect a named profile ("default" is just one of them, not a synthetic entry).
	$effect(() => {
		if (profileOptions.length && !profileOptions.includes(profile))
			profile = profileOptions.includes('default') ? 'default' : profileOptions[0];
	});

	// Proxy: a URI or country code. Geofenced services suggest their own country codes.
	let proxy = $state('');
	let noProxy = $state(false);
	const geofence = $derived(data.services.find((s) => s.tag === service)?.geofence ?? []);
	const browseQs = $derived(
		(() => {
			const p = new URLSearchParams();
			if (profile) p.set('profile', profile);
			if (proxy.trim()) p.set('proxy', proxy.trim());
			if (noProxy) p.set('no_proxy', '1');
			const s = p.toString();
			return s ? `?${s}` : '';
		})()
	);

	// id of the result currently being opened, for per-row loading feedback
	const pendingId = $derived(navigating.to?.params?.id ?? null);

	async function search(e: SubmitEvent) {
		e.preventDefault();
		if (!query.trim() || !service) return;
		loading = true;
		error = null;
		try {
			const res = await api.search({
				service,
				query: query.trim(),
				profile: profile || undefined,
				proxy: proxy.trim() || undefined,
				no_proxy: noProxy || undefined
			});
			results = res.results;
		} catch (err) {
			error = errorMessage(err);
			results = null;
		} finally {
			loading = false;
		}
	}

	// Open a title directly by ID or URL, skipping search (for services with no
	// search, or when you already have the id). The title page feeds it to list-titles.
	async function openDirect() {
		const id = query.trim();
		if (!id || !service) return;
		opening = true;
		try {
			await goto(`/title/${service}/${encodeURIComponent(id)}${browseQs}`);
		} finally {
			opening = false;
		}
	}
</script>

<h1 class="text-2xl font-semibold tracking-tight">Browse</h1>
<p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
	Search a service, or open a title directly by ID or URL.
</p>

{#if data.error}
	<Card class="mt-6 p-4">
		<div class="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
			<Icon name="alert" size={16} class="mt-0.5" />
			<span>
				Couldn't load services: {data.error}. Check the
				<a href="/settings" class="font-medium underline">API settings</a>.
			</span>
		</div>
	</Card>
{/if}

<form onsubmit={search} class="mt-6 space-y-2.5">
	<div class="flex flex-wrap gap-3">
		<div class="relative">
			<select
				bind:value={service}
				onchange={() => {
					profile = '';
					proxy = '';
					noProxy = false;
				}}
				class="appearance-none rounded-lg border border-neutral-200 bg-white py-2 pr-9 pl-3 text-sm font-medium text-neutral-900 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
				aria-label="Service"
			>
				{#each data.services as s (s.tag)}
					<option value={s.tag}>{s.tag}</option>
				{/each}
			</select>
			<div
				class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-neutral-400"
			>
				<Icon name="chevron" size={16} class="rotate-90" />
			</div>
		</div>

		<div class="relative min-w-64 flex-1">
			<div class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
				<Icon name="search" size={16} />
			</div>
			<input
				bind:value={query}
				type="search"
				placeholder="Search titles, or paste a title ID / URL…"
				class="w-full rounded-lg border border-neutral-200 bg-white py-2 pr-3 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
			/>
		</div>

		<Button type="submit" disabled={loading || !query.trim() || !service}>
			{#if loading}<Icon name="loader" spin />Searching…{:else}Search{/if}
		</Button>
		<Button
			type="button"
			variant="secondary"
			onclick={openDirect}
			disabled={opening || !query.trim() || !service}
			title="Load this exact title ID or URL without searching"
		>
			{#if opening}<Icon name="loader" spin />Opening…{:else}Open <Icon
					name="chevron"
					size={16}
				/>{/if}
		</Button>
	</div>

	<!-- The only options search accepts: profile, proxy, no_proxy. -->
	<div
		class="flex flex-wrap items-center gap-2 pl-0.5 text-xs text-neutral-500 dark:text-neutral-400"
	>
		<span class="font-medium">Options</span>

		{#if profileOptions.length > 0}
			<div class="relative">
				<select
					bind:value={profile}
					class="appearance-none rounded-md border border-neutral-200 bg-white py-1 pr-7 pl-2.5 text-xs font-medium text-neutral-900 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
					aria-label="Profile"
				>
					{#each profileOptions as p (p)}
						<option value={p}>{p}</option>
					{/each}
				</select>
				<div
					class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-neutral-400"
				>
					<Icon name="chevron" size={13} class="rotate-90" />
				</div>
			</div>
		{/if}

		<input
			bind:value={proxy}
			type="text"
			list="geofence-{service}"
			disabled={noProxy}
			placeholder={geofence.length
				? `Proxy / country (e.g. ${geofence[0]})`
				: 'Proxy URI or country'}
			title={geofence.length
				? `Geofenced to: ${geofence.join(', ')}. Set a proxy URI or country code.`
				: 'Set a proxy URI or country code.'}
			class="w-44 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
			aria-label="Proxy or country code"
		/>
		{#if geofence.length}
			<datalist id="geofence-{service}">
				{#each geofence as g (g)}<option value={g}></option>{/each}
			</datalist>
		{/if}
		<button
			type="button"
			onclick={() => (noProxy = !noProxy)}
			aria-pressed={noProxy}
			title="Force disable all proxy use for this search"
			class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {noProxy
				? 'bg-accent-600 text-white'
				: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'}"
		>
			No proxy
		</button>
	</div>
</form>

{#if error}
	<Card class="mt-6 p-4">
		<div class="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
			<Icon name="alert" size={16} class="mt-0.5" />
			<span>{error}</span>
		</div>
	</Card>
{:else if results}
	{#if results.length === 0}
		<Card class="mt-6">
			<EmptyState
				icon="search"
				title="No results"
				description="Try a different query or service."
			/>
		</Card>
	{:else}
		<Card
			class="mt-6 divide-y divide-neutral-100 dark:divide-neutral-800 {pendingId
				? 'pointer-events-none'
				: ''}"
		>
			{#each results as r (r.id)}
				<a
					href="/title/{service}/{encodeURIComponent(r.id)}{browseQs}"
					class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50 {pendingId &&
					pendingId !== r.id
						? 'opacity-40'
						: ''}"
				>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="truncate font-medium text-neutral-900 dark:text-neutral-100"
								>{r.title}</span
							>
							{#if r.label}<Badge tone="accent">{r.label}</Badge>{/if}
						</div>
						{#if r.description}
							<p class="mt-0.5 truncate text-sm text-neutral-500 dark:text-neutral-400">
								{r.description}
							</p>
						{/if}
						<p class="mt-0.5 truncate font-mono text-xs text-neutral-400 dark:text-neutral-500">
							{r.id}
						</p>
					</div>
					{#if pendingId === r.id}
						<Icon name="loader" size={18} spin class="shrink-0 text-accent-500" />
					{:else}
						<Icon
							name="chevron"
							size={18}
							class="shrink-0 text-neutral-300 dark:text-neutral-600"
						/>
					{/if}
				</a>
			{/each}
		</Card>
	{/if}
{/if}
