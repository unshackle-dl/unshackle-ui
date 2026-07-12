import { readFileSync } from 'node:fs';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const version = JSON.parse(readFileSync('./package.json', 'utf8')).version;

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(version)
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Thin static client (no backend). SPA fallback because all data is fetched
			// client-side against a user-configured external API (see src/routes/+layout.ts).
			adapter: adapter({ fallback: 'index.html' })
		})
	]
});
