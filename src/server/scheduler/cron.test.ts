import { describe, expect, it } from 'vitest';
import { cronMatches, validCron } from './cron';

describe('cron parser', () => {
	it('validates five-field cron expressions', () => {
		expect(validCron('0 3 * * *')).toBe(true);
		expect(validCron('*/15 * * * *')).toBe(true);
		expect(validCron('0 8 * * 1-5')).toBe(true);
		expect(validCron('99 3 * * *')).toBe(false);
		expect(validCron('0 25 * * *')).toBe(false);
		expect(validCron('0 3 * *')).toBe(false);
	});

	it('matches a schedule in its configured timezone', () => {
		// 06:00 UTC is 03:00 in Recife (UTC-3).
		expect(cronMatches('0 3 * * *', new Date('2026-10-16T06:00:00.000Z'), 'America/Los_Angeles')).toBe(true);
		expect(cronMatches('0 4 * * *', new Date('2026-10-16T06:00:00.000Z'), 'America/Los_Angeles')).toBe(false);
	});
});
