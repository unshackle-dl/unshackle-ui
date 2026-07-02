<script lang="ts">
	import type { Snippet } from 'svelte';

	type Tone = 'neutral' | 'accent' | 'green' | 'amber' | 'red' | 'violet';
	let {
		tone = 'neutral',
		class: cls = '',
		children
	}: { tone?: Tone; class?: string; children: Snippet } = $props();

	const tones: Record<Tone, string> = {
		neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-700/50 dark:text-neutral-300',
		accent: 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300',
		green: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
		amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
		red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
		violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
	};
</script>

<span
	class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium {tones[
		tone
	]} {cls}"
>
	{@render children()}
</span>
