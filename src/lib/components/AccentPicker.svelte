<script lang="ts">
	import { accent, ACCENTS } from '$lib/stores/accent';

	const current = $derived(ACCENTS.find((a) => a.name === $accent) ?? ACCENTS[0]);
</script>

<!-- Single swatch (current accent); hover/focus expands the full set downward. -->
<div class="group relative">
	<button
		class="block h-5 w-5 rounded-full ring-1 ring-neutral-300 ring-offset-1 ring-offset-white transition group-hover:scale-110 dark:ring-neutral-600 dark:ring-offset-neutral-900"
		style="background-color: {current.scale[5]}"
		aria-label="Accent color: {current.name}"
		title="Accent color"
	></button>

	<!-- Opens upward (sidebar bottom); pb-2 keeps the hover area continuous. -->
	<div
		class="invisible absolute bottom-full left-1/2 z-10 -translate-x-1/2 pb-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
	>
		<div
			class="flex flex-col items-center gap-1.5 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
			role="radiogroup"
			aria-label="Accent color"
		>
			{#each ACCENTS as a (a.name)}
				<button
					onclick={() => accent.set(a.name)}
					class="h-5 w-5 rounded-full transition {$accent === a.name
						? 'ring-2 ring-neutral-400 ring-offset-1 ring-offset-white dark:ring-neutral-500 dark:ring-offset-neutral-800'
						: 'hover:scale-110'}"
					style="background-color: {a.scale[5]}"
					title={a.name}
					aria-label={a.name}
					aria-checked={$accent === a.name}
					role="radio"
				></button>
			{/each}
		</div>
	</div>
</div>
