export function isReleaseDay(value: unknown): value is number {
	return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6;
}

export function isReleaseTime(value: unknown): value is string {
	return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isTimeZone(value: unknown): value is string {
	if (typeof value !== 'string' || value.trim() === '') return false;
	try {
		new Intl.DateTimeFormat('en', { timeZone: value });
		return true;
	} catch {
		return false;
	}
}
