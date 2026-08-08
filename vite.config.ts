import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const version = JSON.parse(readFileSync('./package.json', 'utf8')).version;

// Read once at config load, so a running dev server keeps the commit it started with.
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
	// Deployed .env files name their keys PUBLIC_*, so that prefix has to be exposed too.
	envPrefix: ['VITE_', 'PUBLIC_'],
	// Fonts and the favicon are referenced by absolute URL, so they must be served from
	// the web root rather than hashed as build assets.
	publicDir: 'static',
	define: {
		__APP_VERSION__: JSON.stringify(version),
		__APP_COMMIT__: JSON.stringify(commit)
	},
	resolve: {
		alias: { $lib: new URL('./src/lib', import.meta.url).pathname }
	},
	plugins: [
		tailwindcss(),
		// Server mode, because tracking needs a long-lived Node process (sqlite store and
		// poller). Omitting `spa` is what selects the server output: there is no explicit
		// "server: true" flag, `spa` is simply optional with no default. The build emits
		// dist/client + dist/server/server.js and no index.html; see server-runner.mjs.
		tanstackStart(),
		viteReact()
	]
});
