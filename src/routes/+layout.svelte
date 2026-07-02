<script lang="ts">
	import { navigating } from '$app/state';
	import '../app.css';
	import '$lib/stores/theme';
	import '$lib/stores/accent';
	import '$lib/stores/fonts';
	import Sidebar from '$lib/components/Sidebar.svelte';

	let { children } = $props();
</script>

{#if navigating.to}
	<!-- Top progress bar shown while a navigation/load is in flight -->
	<div class="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-accent-500/20">
		<div class="h-full w-1/3 animate-pulse bg-accent-500"></div>
	</div>
{/if}

<div class="flex h-screen overflow-hidden text-neutral-900 dark:text-neutral-100">
	<Sidebar />
	<main class="flex-1 overflow-y-auto">
		<div class="mx-auto max-w-6xl px-8 py-8">
			{@render children()}
		</div>
	</main>
</div>
