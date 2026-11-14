const WEEKDAY: Record<string, number> = {
	Sun: 0,
	Mon: 1,
	Tue: 2,
	Wed: 3,
	Thu: 4,
	Fri: 5,
	Sat: 6
};

function partsAt(value: number, timeZone: string): Record<string, string> {
	return Object.fromEntries(
		new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			weekday: 'short',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		})
			.formatToParts(value)
			.filter((part) => part.type !== 'literal')
			.map(({ type, value: part }) => [type, part])
	);
}

function localTimeAsUtc(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	zone: string
): number {
	const target = Date.UTC(year, month - 1, day, hour, minute);
	let guess = target;
	for (let attempt = 0; attempt < 3; attempt++) {
		const p = partsAt(guess, zone);
		const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
		guess += target - represented;
	}
	return guess;
}

export function previousRelease(day: number, time: string, zone: string, now: number): number {
	const [hour, minute] = time.split(':').map(Number);
	const current = partsAt(now, zone);
	const date = new Date(Date.UTC(+current.year, +current.month - 1, +current.day));
	const daysBack = (WEEKDAY[current.weekday] - day + 7) % 7;
	date.setUTCDate(date.getUTCDate() - daysBack);
	let release = localTimeAsUtc(
		date.getUTCFullYear(),
		date.getUTCMonth() + 1,
		date.getUTCDate(),
		hour,
		minute,
		zone
	);
	if (release > now) release -= 7 * 24 * 60 * 60_000;
	return release;
}
