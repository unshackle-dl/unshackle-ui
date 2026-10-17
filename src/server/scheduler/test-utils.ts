import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

/** Open an isolated sqlite file before importing modules that capture server config. */
export async function openTestDatabase() {
	const directory = mkdtempSync(join(tmpdir(), 'unshackle-scheduler-test-'));
	process.env.TRACKING_DB_PATH = join(directory, 'test.sqlite');
	const { getDb } = await import('../db.ts');
	const db = getDb();
	return {
		db,
		close() {
			db.close();
			(
				globalThis as typeof globalThis & { __unshackleTrackingDb?: DatabaseSync }
			).__unshackleTrackingDb = undefined;
			rmSync(directory, { recursive: true, force: true });
		}
	};
}
