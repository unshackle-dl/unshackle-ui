import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const version = JSON.parse(readFileSync('./package.json', 'utf8')).version;

// Read once at config load, so a running dev server keeps the hash it started with.
// Empty outside a git checkout: source tarball, missing git binary, or a repo with no commits.
let commit = '';
try {
	commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
		cwd: import.meta.dirname,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore'],
		timeout: 2000
	}).trim();
} catch {
	/* leave the stamp empty */
}

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(version),
		__APP_COMMIT__: JSON.stringify(commit)
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
