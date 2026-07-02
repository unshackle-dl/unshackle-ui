<script lang="ts">
	import type { CliParam } from '$lib/api/types';

	// params: this service's cli options (kind === 'option'), from /api/services.
	let {
		service,
		params,
		values = $bindable()
	}: { service: string; params: CliParam[]; values: Record<string, string | boolean> } = $props();

	const flags = $derived(params.filter((p) => p.is_flag));
	const inputs = $derived(params.filter((p) => !p.is_flag));

	// "--better-audio" → "better-audio"; fall back to the param name.
	const label = (p: CliParam) =>
		(p.opts ?? []).find((o) => o.startsWith('--'))?.slice(2) ?? p.name;

	const changedCount = $derived(
		params.filter((p) => {
			const v = values[p.name];
			if (p.is_flag) return v !== (p.default === true);
			const def = p.default == null ? '' : Array.isArray(p.default) ? p.default.join(', ') : String(p.default);
			return String(v ?? '').trim() !== def;
		}).length
	);
</script>

<details class="group rounded-lg border border-neutral-200 dark:border-neutral-700">
	<summary
		class="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-neutral-700 select-none dark:text-neutral-200"
	>
		<span>
			{service} options
			{#if changedCount > 0}
				<span class="ml-1 text-xs font-normal text-accent-600 dark:text-accent-400">
					· {changedCount} set
				</span>
			{/if}
		</span>
		<span class="text-neutral-400 transition-transform group-open:rotate-90">›</span>
	</summary>

	<div class="space-y-3 border-t border-neutral-200 px-3 py-3 dark:border-neutral-700">
		{#if flags.length}
			<div class="flex flex-wrap gap-1.5">
				{#each flags as p (p.name)}
					<button
						type="button"
						title={p.help}
						onclick={() => (values[p.name] = !values[p.name])}
						aria-pressed={values[p.name] === true}
						class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {values[p.name] ===
						true
							? 'bg-accent-600 text-white'
							: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'}"
					>
						{label(p)}
					</button>
				{/each}
			</div>
		{/if}
		{#if inputs.length}
			<div class="grid grid-cols-2 gap-2.5">
				{#each inputs as p (p.name)}
					<label class="block text-xs text-neutral-600 dark:text-neutral-400">
						<span title={p.help}>{label(p)}</span>
						{#if p.choices?.length}
							<select
								bind:value={values[p.name]}
								class="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-900 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
							>
								{#if p.default == null}<option value="">default</option>{/if}
								{#each p.choices as c (c)}
									<option value={c}>{c}</option>
								{/each}
							</select>
						{:else}
							<input
								type={p.type === 'integer' || p.type === 'float' ? 'number' : 'text'}
								step={p.type === 'float' ? 'any' : undefined}
								placeholder={p.multiple ? 'a, b, c…' : undefined}
								bind:value={values[p.name]}
								class="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
							/>
						{/if}
						{#if p.help}
							<span class="mt-0.5 block text-[11px] text-neutral-400 dark:text-neutral-500">
								{p.help}
							</span>
						{/if}
					</label>
				{/each}
			</div>
		{/if}
	</div>
</details>
