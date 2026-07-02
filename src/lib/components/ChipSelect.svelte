<script lang="ts">
	// Reusable multi-select chip group. Empty selection means "all / any": the
	// caller omits the corresponding API filter so the backend includes everything.
	interface Option {
		value: string;
		label: string;
	}
	let {
		label,
		emptyHint = '',
		options,
		selected = $bindable()
	}: {
		label: string;
		emptyHint?: string;
		options: Option[];
		selected: string[];
	} = $props();

	function toggle(v: string) {
		selected = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
	}
</script>

<div>
	{#if label || emptyHint}
		<p class="text-xs font-medium text-neutral-600 dark:text-neutral-400">
			{label}
			{#if selected.length === 0 && emptyHint}
				<span class="font-normal text-neutral-400">· {emptyHint}</span>
			{/if}
		</p>
	{/if}
	<div class="mt-1.5 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
		{#each options as o (o.value)}
			<button
				type="button"
				onclick={() => toggle(o.value)}
				aria-pressed={selected.includes(o.value)}
				class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors {selected.includes(
					o.value
				)
					? 'bg-accent-600 text-white'
					: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'}"
			>
				{o.label}
			</button>
		{/each}
	</div>
</div>
