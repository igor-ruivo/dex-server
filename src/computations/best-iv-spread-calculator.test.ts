import { describe, expect, it } from 'vitest';

import type {
	GameMasterData,
	GameMasterPokemon,
} from '../parsers/types/pokemon';
import { PokemonTypes } from '../parsers/types/pokemon';
import {
	BEST_IV_LEVELS,
	calculateCP,
	calculateHP,
	computeBestIVs,
	computeBestIvSpreads,
	computeBestIvSpreadsForAllSpecies,
	computeBestIvSpreadsPurified,
	LEAGUE_CAPS,
	tiedTop1Patterns,
	tiedTop1PurifiedPatterns,
} from './best-iv-spread-calculator';
import { cpm } from './utils';

const statProdOf = (a: number, d: number, s: number) => Math.round(a * d * s);

describe('calculateCP / calculateHP', () => {
	it('never drops below the game floor of 10', () => {
		expect(calculateCP(1, 0, 1, 0, 1, 0, 0)).toBe(10);
		expect(calculateHP(1, 0, 0)).toBe(10);
	});

	it('increases with IVs and with level', () => {
		const lowIv = calculateCP(150, 0, 150, 0, 150, 0, 78);
		const highIv = calculateCP(150, 15, 150, 15, 150, 15, 78);
		expect(highIv).toBeGreaterThan(lowIv);

		const lowLevel = calculateCP(150, 15, 150, 15, 150, 15, 40);
		const highLevel = calculateCP(150, 15, 150, 15, 150, 15, 78);
		expect(highLevel).toBeGreaterThan(lowLevel);
	});

	it('reproduces the exact hundo CP for a known base-stat line at L40', () => {
		// Azumarill-ish base stats, half-level index (40-1)*2=78 — cross-checked
		// against go-pokedex's own `calculateCP`/`calculateHP` (pokemon-helper.ts)
		// run against the identical inputs.
		expect(calculateCP(112, 15, 152, 15, 225, 15, 78)).toBe(1588);
		expect(calculateHP(225, 15, 78)).toBe(189);
	});
});

describe('computeBestIVs', () => {
	// Azumarill-ish base stats — same fixture go-pokedex's own test suite uses.
	const ATK = 112;
	const DEF = 152;
	const STA = 225;

	it('ranks every one of the 4096 IV combinations when there is no CP cap', () => {
		const ranks = computeBestIVs(ATK, DEF, STA, Number.MAX_VALUE);
		const total = Object.values(ranks).reduce(
			(sum, entries) => sum + entries.length,
			0
		);
		expect(total).toBe(16 * 16 * 16);
	});

	it('keeps every entry under the league CP cap', () => {
		const ranks = computeBestIVs(ATK, DEF, STA, 1500);
		const entries = Object.values(ranks).flat();
		expect(entries.length).toBeGreaterThan(0);
		for (const entry of entries) {
			expect(entry.CP).toBeLessThanOrEqual(1500);
			expect(entry.IVs.A).toBeGreaterThanOrEqual(0);
			expect(entry.IVs.A).toBeLessThanOrEqual(15);
		}
	});
});

describe('tiedTop1Patterns', () => {
	// A mid-range line, deliberately not a boundary case, so the CP cap
	// actually forces a non-hundo optimum for Great/Ultra.
	const ATK = 198;
	const DEF = 189;
	const HP = 190;

	it('returns every entry that shares the #1 (rounded) stat product — never just index 0', () => {
		for (const cap of Object.values(LEAGUE_CAPS)) {
			for (const level of BEST_IV_LEVELS) {
				const flat = Object.values(
					computeBestIVs(ATK, DEF, HP, cap, level)
				).flat();
				const expectedTopProd = statProdOf(
					flat[0].battle.A,
					flat[0].battle.D,
					flat[0].battle.S
				);
				const expectedCount = flat.filter(
					(e) =>
						statProdOf(e.battle.A, e.battle.D, e.battle.S) === expectedTopProd
				).length;

				const patterns = tiedTop1Patterns(ATK, DEF, HP, cap, level);
				expect(patterns.length).toBe(expectedCount);
				expect(patterns[0]).toEqual({
					A: flat[0].IVs.A,
					D: flat[0].IVs.D,
					S: flat[0].IVs.S,
				});
			}
		}
	});

	it('every returned pattern actually fits the cap at some level up to the ceiling', () => {
		for (const cap of [1500, 2500]) {
			for (const level of BEST_IV_LEVELS) {
				const patterns = tiedTop1Patterns(ATK, DEF, HP, cap, level);
				for (const p of patterns) {
					const halfLevelCeiling = (level - 1) * 2;
					let fits = false;
					for (let l = 0; l <= halfLevelCeiling; l++) {
						if (calculateCP(ATK, p.A, DEF, p.D, HP, p.S, l) <= cap) {
							fits = true;
							break;
						}
					}
					expect(fits).toBe(true);
				}
			}
		}
	});

	it('the uncapped Master line always includes the exact hundo (15/15/15)', () => {
		for (const level of BEST_IV_LEVELS) {
			const patterns = tiedTop1Patterns(
				ATK,
				DEF,
				HP,
				LEAGUE_CAPS.master,
				level
			);
			expect(patterns).toContainEqual({ A: 15, D: 15, S: 15 });
		}
	});

	it('returns [] when the cap admits no valid spread at all', () => {
		// A CP cap below what even 0/0/0 at the lowest level can reach.
		expect(tiedTop1Patterns(ATK, DEF, HP, 5, 50)).toEqual([]);
	});
});

describe('tiedTop1PurifiedPatterns', () => {
	const ATK = 198;
	const DEF = 189;
	const HP = 190;

	it('every returned raw pattern purifies (+2, capped 15) into a spread whose stat product ties the best achievable', () => {
		const cap = 1500;
		const levelIndex = (50 - 1) * 2;
		const patterns = tiedTop1PurifiedPatterns(ATK, DEF, HP, cap, levelIndex);
		expect(patterns.length).toBeGreaterThan(0);

		const purify = (iv: number) => Math.min(iv + 2, 15);
		// Same "best level under cap, then stat product" reduction the function
		// itself uses internally — reimplemented independently here so the test
		// actually verifies the tie, not just that the function ran.
		const purifiedProdOf = (p: { A: number; D: number; S: number }) => {
			let level = levelIndex;
			while (
				level >= 0 &&
				calculateCP(
					ATK,
					purify(p.A),
					DEF,
					purify(p.D),
					HP,
					purify(p.S),
					level
				) > cap
			)
				level--;
			expect(level).toBeGreaterThanOrEqual(0);
			const aSt = (ATK + purify(p.A)) * cpm[level];
			const dSt = (DEF + purify(p.D)) * cpm[level];
			const sSt = calculateHP(HP, purify(p.S), level);
			return statProdOf(aSt, dSt, sSt);
		};

		const expectedProd = purifiedProdOf(patterns[0]);
		for (const p of patterns) {
			expect(purifiedProdOf(p)).toBe(expectedProd);
		}
	});

	it('13, 14, and 15 all purify to the same 15 — so a raw 13 can tie a raw 15 for the purified optimum', () => {
		// Exact hundo (15/15/15) always purifies to itself; a raw 13/13/13 also
		// purifies to 15/15/15 — both must tie for the purified-best pattern set.
		const levelIndex = (50 - 1) * 2;
		const patterns = tiedTop1PurifiedPatterns(
			300,
			200,
			200,
			Number.MAX_VALUE,
			levelIndex
		);
		const hasHundo = patterns.some(
			(p) => p.A === 15 && p.D === 15 && p.S === 15
		);
		const has13 = patterns.some((p) => p.A === 13 && p.D === 13 && p.S === 13);
		expect(hasHundo).toBe(true);
		expect(has13).toBe(true);
	});
});

describe('computeBestIvSpreads', () => {
	const stats = { atk: 198, def: 189, hp: 190 };

	it('covers every league and every level with at least one pattern', () => {
		const spreads = computeBestIvSpreads(stats);
		for (const league of Object.keys(LEAGUE_CAPS) as Array<
			keyof typeof LEAGUE_CAPS
		>) {
			for (const level of BEST_IV_LEVELS) {
				const key = `level${level}` as const;
				expect(spreads[league][key].length).toBeGreaterThan(0);
				for (const p of spreads[league][key]) {
					expect(p.A).toBeGreaterThanOrEqual(0);
					expect(p.A).toBeLessThanOrEqual(15);
				}
			}
		}
	});
});

describe('computeBestIvSpreadsPurified', () => {
	it('matches tiedTop1PurifiedPatterns for the same inputs (level->half-level conversion is correct)', () => {
		const stats = { atk: 198, def: 189, hp: 190 };
		const spreads = computeBestIvSpreadsPurified(stats);
		const direct = tiedTop1PurifiedPatterns(
			stats.atk,
			stats.def,
			stats.hp,
			LEAGUE_CAPS.great,
			(50 - 1) * 2
		);
		expect(spreads.great.level50).toEqual(direct);
	});
});

describe('computeBestIvSpreadsForAllSpecies', () => {
	const makePokemon = (
		overrides: Partial<GameMasterPokemon>
	): GameMasterPokemon => ({
		dex: 1,
		speciesId: 'test_mon',
		speciesName: 'Test Mon',
		types: [PokemonTypes.Normal],
		fastMoves: [],
		chargedMoves: [],
		baseStats: { atk: 198, def: 189, hp: 190 },
		imageUrl: '',
		goImageUrl: '',
		shinyGoImageUrl: '',
		isShadow: false,
		isMega: false,
		isSuperMega: false,
		form: '',
		isLegendary: false,
		isMythical: false,
		isBeast: false,
		...overrides,
	});

	it('adds bestIvSpreads for every species, and bestIvSpreadsPurified only for Shadow ones', () => {
		const dict: GameMasterData = {
			test_mon: makePokemon({ speciesId: 'test_mon', isShadow: false }),
			test_mon_shadow: makePokemon({
				speciesId: 'test_mon_shadow',
				isShadow: true,
			}),
		};

		const result = computeBestIvSpreadsForAllSpecies(dict);

		expect(result.test_mon.bestIvSpreads).toBeDefined();
		expect(result.test_mon.bestIvSpreadsPurified).toBeUndefined();

		expect(result.test_mon_shadow.bestIvSpreads).toBeDefined();
		expect(result.test_mon_shadow.bestIvSpreadsPurified).toBeDefined();
	});

	it('never mutates the input gamemaster', () => {
		const dict: GameMasterData = { test_mon: makePokemon({}) };
		computeBestIvSpreadsForAllSpecies(dict);
		expect(dict.test_mon).not.toHaveProperty('bestIvSpreads');
	});
});
