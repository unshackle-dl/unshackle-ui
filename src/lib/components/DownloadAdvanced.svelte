<script lang="ts">
	import { ADVANCED_FIELDS, type Field } from '$lib/download';

	// profileOptions: null = profiles fetch failed (keep free-text fallback),
	// [] = service has no named profiles (hide), [..] = render a picker.
	let {
		values = $bindable(),
		profileOptions = null
	}: { values: Record<string, string | boolean>; profileOptions?: string[] | null } = $props();

	function toggle(key: string) {
		values[key] = !values[key];
	}

	const isBool = (f: Field) => f.type === 'bool';

	const activeCount = $derived(
		Object.entries(values).filter(
			([, v]) => v === true || (typeof v === 'string' && v.trim() !== '')
		).length
	);
</script>

<details class="group rounded-lg border border-neutral-200 dark:border-neutral-700">
	<summary
		class="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-neutral-700 select-none dark:text-neutral-200"
	>
		<span>
			Advanced options
			{#if activeCount > 0}
				<span class="ml-1 text-xs font-normal text-accent-600 dark:text-accent-400">
					· {activeCount} set
				</span>
			{/if}
		</span>
		<span class="text-neutral-400 transition-transform group-open:rotate-90">›</span>
	</summary>

	<div class="space-y-4 border-t border-neutral-200 px-3 py-3 dark:border-neutral-700">
		{#each ADVANCED_FIELDS as g (g.group)}
			{@const bools = g.fields.filter(isBool)}
			{@const inputs = g.fields.filter((f) => !isBool(f))}
			<div>
				<p
					class="text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
				>
					{g.group}
				</p>
				{#if bools.length}
					<div class="mt-1.5 flex flex-wrap gap-1.5">
						{#each bools as f (f.key)}
							<button
								type="button"
								title={f.help}
								onclick={() => toggle(f.key)}
								aria-pressed={values[f.key] === true}
								class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {values[
									f.key
								] === true
									? 'bg-accent-600 text-white'
									: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'}"
							>
								{f.label}
							</button>
						{/each}
					</div>
				{/if}
				{#if inputs.length}
					<div class="mt-2 grid grid-cols-2 gap-2.5">
						{#each inputs as f (f.key)}
							{#if f.key === 'profile' && profileOptions !== null}
								{#if profileOptions.length > 0}
									<label class="block text-xs text-neutral-600 dark:text-neutral-400">
										<span title={f.help}>{f.label}</span>
										<select
											bind:value={values[f.key]}
											class="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-900 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
										>
											<option value="">default</option>
											{#each profileOptions as p (p)}
												<option value={p}>{p}</option>
											{/each}
										</select>
									</label>
								{/if}
							{:else}
								<label class="block text-xs text-neutral-600 dark:text-neutral-400">
									<span title={f.help}>{f.label}</span>
									<input
										type={f.type === 'int' || f.type === 'num' ? 'number' : 'text'}
										step={f.type === 'num' ? 'any' : undefined}
										placeholder={f.placeholder}
										bind:value={values[f.key]}
										class="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
									/>
								</label>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</details>
