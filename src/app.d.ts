declare global {
	// Must stay inside `declare global`: the `export {}` below makes this file a module,
	// so a top-level interface would be module-scoped and never merge with Vite's own,
	// leaving these typed as `any` with no error to show for it.
	interface ImportMetaEnv {
		// Exposed to the client by the PUBLIC_ entry in vite.config.ts envPrefix.
		readonly PUBLIC_UNSHACKLE_API_URL?: string;
		readonly PUBLIC_UNSHACKLE_API_KEY?: string;
	}

	// Injected by Vite `define` (see vite.config.ts)
	const __APP_VERSION__: string;
	const __APP_COMMIT__: string;
}

export {};
