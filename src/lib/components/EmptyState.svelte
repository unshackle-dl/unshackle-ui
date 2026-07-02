<script lang="ts">
	import Icon, { type IconName } from './Icon.svelte';
	let {
		icon = 'film',
		title,
		description = ''
	}: { icon?: IconName; title: string; description?: string } = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
	<div
		class="rounded-full bg-neutral-100 p-3 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
	>
		<Icon name={icon} size={24} />
	</div>
	<p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{title}</p>
	{#if description}
		<p class="max-w-sm text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
	{/if}
</div>
