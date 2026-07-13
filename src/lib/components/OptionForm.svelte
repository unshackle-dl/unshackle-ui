<script lang="ts">
	import { coerce, type Field } from '$lib/options';
	import { mask } from '$lib/stores/incognito';

	// Collapsible option form for any Field[]: bools as chips, the rest as a grid, groups headed.
	let {
		title,
		fields,
		values = $bindable()
	}: { title: string; fields: Field[]; values: Record<string, string | boolean> } = $props();

	// "N set" = however many values coerce would actually send.
	const setCount = $derived(Object.keys(coerce(fields, values)).length);

	const groups = $derived.by(() => {
		const out: { name: string | undefined; bools: Field[]; inputs: Field[] }[] = [];
		for (const f of fields) {
			let g = out.at(-1);
			if (!g || g.name !== f.group) {
				g = { name: f.group, bools: [], inputs: [] };
				out.push(g);
			}
			(f.type === 'bool' ? g.bools : g.inputs).push(f);
		}
		return out;
	});
</script>

<details class="group rounded-lg border border-neutral-200 dark:border-neutral-700">
	<summary
		class="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-neutral-700 select-none dark:text-neutral-200"
	>
		<span>
			{title}
			{#if setCount > 0}
				<span class="ml-1 text-xs font-normal text-accent-600 dark:text-accent-400">
					· {setCount} set
				</span>
			{/if}
		</span>
		<span class="text-neutral-400 transition-transform group-open:rotate-90">›</span>
	</summary>

	<div class="space-y-4 border-t border-neutral-200 px-3 py-3 dark:border-neutral-700">
		{#each groups as g (g.name ?? '_')}
			<div>
				{#if g.name}
					<p
						class="text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
					>
						{g.name}
					</p>
				{/if}
				{#if g.bools.length}
					<div class="mt-1.5 flex flex-wrap gap-1.5">
						{#each g.bools as f (f.key)}
							<button
								type="button"
								title={f.help}
								onclick={() => (values[f.key] = values[f.key] !== true)}
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
				{#if g.inputs.length}
					<div class="mt-2 grid grid-cols-2 gap-2.5" class:mt-1.5={!g.bools.length}>
						{#each g.inputs as f (f.key)}
							<label class="block text-xs text-neutral-600 dark:text-neutral-400">
								<span title={f.help}>{f.label}</span>
								{#if f.type === 'choice'}
									<select
										bind:value={values[f.key]}
										class="mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-900 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
									>
										{#if !f.default}<option value="">default</option>{/if}
										{#each f.choices ?? [] as c (c)}
											<option value={c}>{f.key === 'profile' ? $mask.profile(c) : c}</option>
										{/each}
									</select>
								{:else}
									<input
										type={f.type === 'int' || f.type === 'num' ? 'number' : 'text'}
										step={f.type === 'num' ? 'any' : undefined}
										placeholder={f.placeholder}
										bind:value={values[f.key]}
										class="redact mt-1 w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/30 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
									/>
								{/if}
								{#if f.help}
									<span class="mt-0.5 block text-[11px] text-neutral-400 dark:text-neutral-500">
										{f.help}
									</span>
								{/if}
							</label>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</details>
