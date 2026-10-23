export interface WeeklyRecurrence {
	daysOfWeek: number[];
	time: string;
}

function zonedParts(timestamp: number, timeZone: string) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(timestamp);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return {
		year: Number(values.year), month: Number(values.month), day: Number(values.day),
		hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second)
	};
}

function localToEpoch(
	date: { year: number; month: number; day: number },
	time: { hour: number; minute: number; second: number },
	timeZone: string
): number {
	const target = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, time.second);
	let estimate = target;
	for (let i = 0; i < 3; i++) {
		const actual = zonedParts(estimate, timeZone);
		const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
		estimate += target - represented;
	}
	return estimate;
}

export function nextWeeklyRun(recurrence: WeeklyRecurrence, timeZone: string, after: number): number {
	const [hour, minute, second] = recurrence.time.split(':').map(Number);
	const localNow = zonedParts(after, timeZone);
	const start = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day));
	for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
		const date = new Date(start.getTime() + dayOffset * 86_400_000);
		if (!recurrence.daysOfWeek.includes(date.getUTCDay())) continue;
		const candidate = localToEpoch(
			{ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() },
			{ hour, minute, second },
			timeZone
		);
		if (candidate > after) return candidate;
	}
	throw new Error('Could not calculate the next weekly run.');
}
