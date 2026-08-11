// Custom TanStack Start server entry (src/server.ts is the default-resolved path).
//
// This module is the only one guaranteed to evaluate at server boot. Route modules are not
// evaluated until their route is first requested, so anything long-lived (the poller) has
// to be started from here or it silently never runs on an idle server. Such registration
// must also be idempotent: dev re-evaluates this module on HMR, and `npm run dev` does not
// evaluate it at all until the first HTTP request, so an idle dev server is no evidence
// either way.
//
// The built artifact is dist/server/server.js, a fetch handler and NOT an HTTP listener.
// See server-runner.mjs for the process that turns it into one.
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
import { config } from './server/config';
import { getDb } from './server/db';
import { startPoller } from './server/poller';
import { loadSettings } from './server/settings';

const fetch = createStartHandler(defaultStreamHandler);

// Opened eagerly so a missing or unwritable data directory fails at boot with a clear
// stack, rather than as a 500 on whichever tracking request arrives first.
getDb();
// Web-set overrides live in the db just opened, so they load between it and the poller.
loadSettings();
// Dev HMR re-evaluates this module on every save; log the boot line once per process.
declare global {
	var __unshackleBootLogged: boolean | undefined;
}
if (!globalThis.__unshackleBootLogged) {
	globalThis.__unshackleBootLogged = true;
	console.log(`[unshackle-ui] tracking store ${config.dbPath}, upstream ${config.apiUrl}`);
}
startPoller();

export default {
	async fetch(...args: Parameters<typeof fetch>) {
		return await fetch(...args);
	}
};
