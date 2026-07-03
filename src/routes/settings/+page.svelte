<script lang="ts">
	import { onMount } from 'svelte';
	import { api, errorMessage } from '$lib/api/client';
	import type { EnvCheck, Health, RefreshServicesResponse, ServerConfig } from '$lib/api/types';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { settings } from '$lib/config';
	import { sansFont, SANS_FONTS, monoFont, MONO_FONTS } from '$lib/stores/fonts';

	let draft = $state({ apiUrl: $settings.apiUrl, apiKey: $settings.apiKey });
	let saved = $state(false);

	type TestState =
		| { kind: 'idle' }
		| { kind: 'testing' }
		| { kind: 'ok'; health: Health }
		| { kind: 'error'; message: string };
	let test = $state<TestState>({ kind: 'idle' });

	function save() {
		settings.set({ apiUrl: draft.apiUrl.trim(), apiKey: draft.apiKey.trim() });
		saved = true;
		setTimeout(() => (saved = false), 1500);
	}

	async function testConnection() {
		save();
		test = { kind: 'testing' };
		try {
			const health = await api.health();
			test = { kind: 'ok', health };
			loadServer();
		} catch (e) {
			test = { kind: 'error', message: errorMessage(e) };
		}
	}

	// Server config + environment checks; sections stay hidden until these load.
	let server = $state<ServerConfig | null>(null);
	let envChecks = $state<EnvCheck[] | null>(null);

	async function loadServer() {
		try {
			server = await api.config();
		} catch {
			server = null;
		}
		try {
			envChecks = await api.envCheck();
		} catch {
			envChecks = null;
		}
	}
	onMount(loadServer);

	type MaintState =
		| { kind: 'idle' }
		| { kind: 'confirm' }
		| { kind: 'running' }
		| { kind: 'ok'; message: string }
		| { kind: 'error'; message: string };
	let ops = $state<Record<'temp' | 'refresh', MaintState>>({
		temp: { kind: 'idle' },
		refresh: { kind: 'idle' }
	});
	let refreshRepos = $state<RefreshServicesResponse['repos']>([]);

	function formatBytes(n: number): string {
		if (n < 1024) return `${n} B`;
		const units = ['KB', 'MB', 'GB', 'TB'];
		let v = n / 1024;
		let i = 0;
		while (v >= 1024 && i < units.length - 1) {
			v /= 1024;
			i++;
		}
		return `${v.toFixed(1)} ${units[i]}`;
	}

	async function runClear(which: 'temp') {
		ops[which] = { kind: 'running' };
		try {
			const r = await api.clearTemp();
			ops[which] = { kind: 'ok', message: `Cleared, freed ${formatBytes(r.freed_bytes)}.` };
		} catch (e) {
			ops[which] = { kind: 'error', message: errorMessage(e) };
		}
	}

	async function runRefresh() {
		ops.refresh = { kind: 'running' };
		refreshRepos = [];
		try {
			const r = await api.refreshServices();
			refreshRepos = r.repos;
			ops.refresh = r.refreshed
				? {
						kind: 'ok',
						message:
							r.repos.length === 0
								? 'No service repos configured.'
								: r.repos.every((repo) => repo.changes.length === 0)
									? 'All service repos already up to date.'
									: 'Service repos refreshed.'
					}
				: { kind: 'error', message: 'One or more repos failed to sync.' };
		} catch (e) {
			ops.refresh = { kind: 'error', message: errorMessage(e) };
		}
	}
</script>

<h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
<p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
	Point the UI at your unshackle API. Stored in this browser only.
</p>

<Card class="mt-6 max-w-2xl p-6">
	<div class="space-y-5">
		<div>
			<label for="apiUrl" class="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
				API base URL
			</label>
			<input
				id="apiUrl"
				type="url"
				bind:value={draft.apiUrl}
				placeholder="http://localhost:8786"
				class="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
			/>
			<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
				All requests go to this origin. Leave off any trailing <code class="font-mono">/api</code>.
			</p>
		</div>

		<div>
			<label for="apiKey" class="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
				Secret key
				<span class="font-normal text-neutral-400">(optional)</span>
			</label>
			<input
				id="apiKey"
				type="password"
				bind:value={draft.apiKey}
				placeholder="leave blank for --no-key deployments"
				autocomplete="off"
				class="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
			/>
			<p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
				Sent as <code class="font-mono">X-Secret-Key</code> on every request when set.
			</p>
		</div>

		<div class="flex items-center gap-3 pt-1">
			<Button onclick={testConnection} disabled={test.kind === 'testing'}>
				{#if test.kind === 'testing'}
					<Icon name="loader" spin />
					Testing…
				{:else}
					<Icon name="plug" />
					Test &amp; save
				{/if}
			</Button>
			<Button variant="secondary" onclick={save}>Save</Button>
			{#if saved}
				<span class="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
					<Icon name="check" size={16} /> Saved
				</span>
			{/if}
		</div>

		{#if test.kind === 'ok'}
			<div
				class="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-300"
			>
				<Icon name="check" size={16} class="mt-0.5" />
				<span>
					Connected. Status <strong>{test.health.status}</strong>, unshackle
					<strong>v{test.health.version}</strong>.
				</span>
			</div>
			{#if test.health.update_check?.update_available}
				<div
					class="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
				>
					<Icon name="alert" size={16} class="mt-0.5" />
					<span>
						Update available → <strong>v{test.health.update_check.latest_version}</strong>
						(running v{test.health.update_check.current_version}).
					</span>
				</div>
			{/if}
		{:else if test.kind === 'error'}
			<div
				class="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
			>
				<Icon name="alert" size={16} class="mt-0.5" />
				<span>{test.message}</span>
			</div>
		{/if}
	</div>
</Card>

{#if server}
	<h2 class="mt-10 text-lg font-semibold tracking-tight">Server</h2>
	<p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
		Read-only defaults reported by the connected API.
	</p>

	<Card class="mt-6 max-w-2xl p-6">
		<dl class="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
			<div>
				<dt class="text-xs font-medium text-neutral-500 dark:text-neutral-400">
					Max concurrent downloads
				</dt>
				<dd class="mt-0.5 font-medium text-neutral-900 dark:text-neutral-100">
					{server.serve.max_concurrent_downloads}
				</dd>
			</div>
			<div>
				<dt class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Job retention</dt>
				<dd class="mt-0.5 font-medium text-neutral-900 dark:text-neutral-100">
					{server.serve.job_retention_hours} h
				</dd>
			</div>
			<div>
				<dt class="text-xs font-medium text-neutral-500 dark:text-neutral-400">History kept</dt>
				<dd class="mt-0.5 font-medium text-neutral-900 dark:text-neutral-100">
					{server.serve.history_limit > 0 ? `${server.serve.history_limit} jobs` : 'unlimited'}
				</dd>
			</div>
			<div>
				<dt class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Output directory</dt>
				<dd class="mt-0.5 font-mono text-xs break-all text-neutral-900 dark:text-neutral-100">
					{server.directories.downloads}
				</dd>
			</div>
			<div>
				<dt class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Temp directory</dt>
				<dd class="mt-0.5 font-mono text-xs break-all text-neutral-900 dark:text-neutral-100">
					{server.directories.temp}
				</dd>
			</div>
			<div class="sm:col-span-2">
				<dt class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Allowed services</dt>
				<dd class="mt-1 flex flex-wrap gap-1.5">
					{#if server.serve.services === null}
						<Badge tone="green">all</Badge>
					{:else}
						{#each server.serve.services as s (s)}
							<Badge>{s}</Badge>
						{/each}
					{/if}
				</dd>
			</div>
		</dl>
	</Card>

	<h2 class="mt-10 text-lg font-semibold tracking-tight">Maintenance</h2>
	<p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
		One-off server housekeeping. Clearing is destructive and asks to confirm.
	</p>

	<Card class="mt-6 max-w-2xl divide-y divide-neutral-100 p-0 dark:divide-neutral-800">
		{#each [{ key: 'temp' as const, label: 'Clear temp', desc: `Empties ${server.directories.temp}` }] as row (row.key)}
			{@const op = ops[row.key]}
			<div class="px-6 py-4">
				<div class="flex items-center justify-between gap-4">
					<div class="min-w-0">
						<p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{row.label}</p>
						<p class="mt-0.5 truncate font-mono text-xs text-neutral-400 dark:text-neutral-500">
							{row.desc}
						</p>
					</div>
					<div class="flex shrink-0 items-center gap-2">
						{#if op.kind === 'confirm'}
							<Button variant="danger" onclick={() => runClear(row.key)}>
								<Icon name="trash" size={16} /> Confirm
							</Button>
							<Button variant="secondary" onclick={() => (ops[row.key] = { kind: 'idle' })}>
								Cancel
							</Button>
						{:else}
							<Button
								variant="secondary"
								disabled={op.kind === 'running'}
								onclick={() => (ops[row.key] = { kind: 'confirm' })}
							>
								{#if op.kind === 'running'}<Icon name="loader" spin />{:else}<Icon
										name="trash"
										size={16}
									/>{/if}
								{row.label}
							</Button>
						{/if}
					</div>
				</div>
				{#if op.kind === 'ok'}
					<p class="mt-2 flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
						<Icon name="check" size={14} />
						{op.message}
					</p>
				{:else if op.kind === 'error'}
					<p class="mt-2 flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
						<Icon name="alert" size={14} />
						{op.message}
					</p>
				{/if}
			</div>
		{/each}

		<div class="px-6 py-4">
			<div class="flex items-center justify-between gap-4">
				<div class="min-w-0">
					<p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">Refresh services</p>
					<p class="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
						Sync configured service repos.
					</p>
				</div>
				<Button variant="secondary" disabled={ops.refresh.kind === 'running'} onclick={runRefresh}>
					{#if ops.refresh.kind === 'running'}<Icon name="loader" spin />{:else}<Icon
							name="retry"
							size={16}
						/>{/if}
					Refresh services
				</Button>
			</div>
			{#if ops.refresh.kind === 'ok'}
				<p class="mt-2 flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
					<Icon name="check" size={14} />
					{ops.refresh.message}
				</p>
			{:else if ops.refresh.kind === 'error'}
				<p class="mt-2 flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
					<Icon name="alert" size={14} />
					{ops.refresh.message}
				</p>
			{/if}
			{#if refreshRepos.length > 0}
				<div class="mt-2 space-y-1">
					{#each refreshRepos as repo (repo.spec)}
						<div class="text-xs">
							<span
								class="font-mono {repo.updated
									? 'text-neutral-500 dark:text-neutral-400'
									: 'text-red-600 dark:text-red-400'}"
							>
								{repo.spec}{repo.updated ? '' : ' (failed)'}
							</span>
							{#each repo.changes as c (c)}
								<p class="ml-3 font-mono text-neutral-400 dark:text-neutral-500">{c}</p>
							{/each}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</Card>
{/if}

{#if envChecks}
	<h2 class="mt-10 text-lg font-semibold tracking-tight">Environment</h2>
	<p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
		Binaries detected on the server. Versions are best-effort probes.
	</p>

	<Card class="mt-6 max-w-2xl p-6">
		<ul class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
			{#each envChecks as c (c.name)}
				<li class="flex items-center gap-2 text-sm">
					{#if c.installed}
						<Icon name="check" size={14} class="shrink-0 text-green-600 dark:text-green-400" />
					{:else}
						<Icon
							name="x"
							size={14}
							class="shrink-0 {c.required
								? 'text-red-600 dark:text-red-400'
								: 'text-neutral-400 dark:text-neutral-500'}"
						/>
					{/if}
					<span
						class="truncate {c.installed
							? 'text-neutral-900 dark:text-neutral-100'
							: 'text-neutral-400 dark:text-neutral-500'}">{c.name}</span
					>
					{#if c.version}
						<span class="truncate font-mono text-xs text-neutral-400 dark:text-neutral-500">
							{c.version}
						</span>
					{/if}
					{#if c.required && !c.installed}
						<Badge tone="red">required</Badge>
					{/if}
				</li>
			{/each}
		</ul>
	</Card>
{/if}

<h2 class="mt-10 text-lg font-semibold tracking-tight">Appearance</h2>
<p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
	Choose the fonts used across the UI. Applied instantly and saved in this browser.
</p>

<Card class="mt-6 max-w-2xl p-6">
	<div class="space-y-5">
		<div>
			<label
				for="sansFont"
				class="block text-sm font-medium text-neutral-700 dark:text-neutral-200"
			>
				UI font
			</label>
			<div class="relative mt-1.5">
				<select
					id="sansFont"
					bind:value={$sansFont}
					class="w-full appearance-none rounded-lg border border-neutral-200 bg-white py-2 pr-9 pl-3 text-sm text-neutral-900 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
				>
					{#each SANS_FONTS as f (f.name)}
						<option value={f.name} style="font-family: {f.stack}">{f.name}</option>
					{/each}
				</select>
				<div
					class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-neutral-400"
				>
					<Icon name="chevron" size={16} class="rotate-90" />
				</div>
			</div>
		</div>

		<div>
			<label
				for="monoFont"
				class="block text-sm font-medium text-neutral-700 dark:text-neutral-200"
			>
				Monospace font
			</label>
			<div class="relative mt-1.5">
				<select
					id="monoFont"
					bind:value={$monoFont}
					class="w-full appearance-none rounded-lg border border-neutral-200 bg-white py-2 pr-9 pl-3 font-mono text-sm text-neutral-900 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
				>
					{#each MONO_FONTS as f (f.name)}
						<option value={f.name} style="font-family: {f.stack}">{f.name}</option>
					{/each}
				</select>
				<div
					class="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-neutral-400"
				>
					<Icon name="chevron" size={16} class="rotate-90" />
				</div>
			</div>
		</div>
	</div>
</Card>
