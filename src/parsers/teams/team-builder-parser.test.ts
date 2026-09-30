import { describe, expect, it } from 'vitest';

import { calculateCP } from '../../computations/best-iv-spread-calculator';
import { moveAbbreviation, pickBestIvs } from './team-builder-parser';

describe('moveAbbreviation', () => {
	it('prefers PvPoke explicit abbreviations', () => {
		expect(moveAbbreviation({ moveId: 'ACID', abbreviation: 'Ac' })).toBe('Ac');
	});

	it('falls back to the initials of each word', () => {
		expect(moveAbbreviation({ moveId: 'SHADOW_BALL' })).toBe('SB');
	});
});

describe('pickBestIvs', () => {
	const azumarill = { atk: 112, def: 152, hp: 225 };

	it('takes the only tied pattern and puts it at the highest level that fits the cap', () => {
		const [level, atk, def, hp] = pickBestIvs(
			[{ A: 0, D: 15, S: 15 }],
			azumarill,
			1500
		)!;
		expect([atk, def, hp]).toEqual([0, 15, 15]);
		const cp = (l: number) =>
			calculateCP(
				azumarill.atk,
				0,
				azumarill.def,
				15,
				azumarill.hp,
				15,
				(l - 1) * 2
			);
		expect(cp(level)).toBeLessThanOrEqual(1500);
		expect(cp(level + 0.5)).toBeGreaterThan(1500);
	});

	it('breaks ties toward the highest numbers: Attack first, then Defense, then HP', () => {
		expect(
			pickBestIvs(
				[
					{ A: 14, D: 15, S: 15 },
					{ A: 15, D: 13, S: 15 },
					{ A: 15, D: 14, S: 12 },
					{ A: 15, D: 14, S: 14 },
				],
				azumarill,
				Number.MAX_VALUE
			)!.slice(1)
		).toEqual([15, 14, 14]);
	});

	it('uses level 50 when the cap does not bind', () => {
		expect(
			pickBestIvs([{ A: 15, D: 15, S: 15 }], azumarill, Number.MAX_VALUE)
		).toEqual([50, 15, 15, 15]);
	});

	it('has nothing to pick when the cap admits no spread', () => {
		expect(pickBestIvs([], azumarill, 1500)).toBeUndefined();
		expect(
			pickBestIvs([{ A: 0, D: 0, S: 0 }], { atk: 400, def: 400, hp: 400 }, 100)
		).toBeUndefined();
	});
});
