<script lang="ts">
	import type { Snippet } from 'svelte';
	let { class: cls = '', children }: { class?: string; children: Snippet } = $props();
</script>

<div
	class="rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-800/50 {cls}"
>
	{@render children()}
</div>
