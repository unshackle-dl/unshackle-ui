/** Small dependency-free five-field cron parser (minute hour day-of-month month day-of-week). */
function matchesField(field: string, value: number, min: number, max: number): boolean {
	return field.split(',').some((part) => {
		const [base, stepRaw] = part.split('/');
		const step = stepRaw === undefined ? 1 : Number(stepRaw);
		if (!Number.isInteger(step) || step < 1) return false;
		let start = min;
		let end = max;
		if (base !== '*') {
			if (base.includes('-')) {
				const [a, b] = base.split('-').map(Number);
				if (!Number.isInteger(a) || !Number.isInteger(b)) return false;
				start = a;
				end = b;
			} else {
				start = Number(base);
				end = stepRaw === undefined ? start : max;
			}
		}
		if (start < min || end > max || start > end) return false;
		return value >= start && value <= end && (value - start) % step === 0;
	});
}

export function validCron(expression: string): boolean {
	const fields = expression.trim().split(/\s+/);
	if (fields.length !== 5) return false;
	const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]] as const;
	return fields.every((field, index) => {
		const [min, max] = ranges[index];
		return field.split(',').every((part) => {
			if (!part) return false;
			const [base, step, extra] = part.split('/');
			if (extra !== undefined || (step !== undefined && (!/^\d+$/.test(step) || Number(step) < 1))) return false;
			if (base === '*') return true;
			const values = base.split('-');
			if (values.length > 2 || values.some((n) => !/^\d+$/.test(n))) return false;
			const numbers = values.map(Number);
			return numbers.every((n) => n >= min && n <= max) && (numbers.length === 1 || numbers[0] <= numbers[1]);
		});
	});
}

const formatters = new Map<string, Intl.DateTimeFormat>();

export function cronMatches(expression: string, date: Date, timeZone: string): boolean {
	const fields = expression.trim().split(/\s+/);
	let formatter = formatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-US', {
			timeZone, minute: 'numeric', hour: 'numeric', day: 'numeric', month: 'numeric', weekday: 'short', hourCycle: 'h23'
		});
		formatters.set(timeZone, formatter);
	}
	const parts = formatter.formatToParts(date);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
	const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
	const dom = matchesField(fields[2], Number(get('day')), 1, 31);
	const dow = matchesField(fields[4], weekday, 0, 7) || (weekday === 0 && matchesField(fields[4], 7, 0, 7));
	// Standard cron: when both day fields are restricted, either may match.
	const dayMatch = fields[2] !== '*' && fields[4] !== '*' ? dom || dow : dom && dow;
	return matchesField(fields[0], Number(get('minute')), 0, 59) &&
		matchesField(fields[1], Number(get('hour')), 0, 23) && dayMatch &&
		matchesField(fields[3], Number(get('month')), 1, 12);
}
