import { describe, expect, it } from 'vitest';
import { isAdult } from './justwatch';

describe('isAdult', () => {
	it('flags 18+ and unrated', () => {
		for (const c of ['A', '18', '18+', 'R18+', 'M18', 'NC-17', 'X', 'R21', 'UNRATED', '', null])
			expect(isAdult(c), String(c)).toBe(true);
	});
	it('passes everyday ratings', () => {
		for (const c of ['U', 'UA', 'UA13+', 'UA16+', 'PG-13', 'R', 'TV-MA', '12A', '15', '16'])
			expect(isAdult(c), c).toBe(false);
	});
});
