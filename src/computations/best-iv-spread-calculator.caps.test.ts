import { describe, expect, it } from 'vitest';

import type { GameMasterData, GameMasterPokemon } from '../parsers/types/pokemon';
import { PokemonTypes } from '../parsers/types/pokemon';
import { ivsKeyForCap } from '../parsers/types/teams';
import { pickBestIvs } from '../parsers/teams/team-builder-parser';
import {
	BEST_IV_LEVELS,
	calculateCP,
	computeBestIvSpreads,
	computeBestIvSpreadsForAllSpecies,
	computeBestIvSpreadsPurified,
	extraCaps,
	LEAGUE_CAPS,
	tiedTop1Patterns,
	tiedTop1PurifiedPatterns,
} from './best-iv-spread-calculator';
import { computeSpeciesSearchMetadata } from './species-search-metadata-calculator';
import { MAX_LEVEL } from './utils';

/**
 * A rotating / custom cup can have a CP cap the three permanent leagues do not (a Little Cup's 500): every species then needs
 * its tied-for-rank-1 IV spreads at that cap too — for Mass Delete's sweeps and for the Teams view's rank-1 spreads.
 */
const stats = { atk: 198, def: 189, hp: 190 };

describe('extraCaps', () => {
	it('keeps the caps the permanent leagues do not have, each once, lowest first', () => {
		expect(extraCaps([1500, 500, 2500, 10000, 500, 1800])).toEqual([500, 1800]);
	});

	it('is empty when every cup is at a permanent cap, or there are none', () => {
		expect(extraCaps([1500, 2500, 10000, 1500])).toEqual([]);
		expect(extraCaps([])).toEqual([]);
	});
});

describe('computeBestIvSpreads with a 500 CP cup', () => {
	const spreads = computeBestIvSpreads(stats, [500]);

	it('keeps the three permanent leagues and adds the cap under the key the team builder uses', () => {
		expect(Object.keys(spreads).sort()).toEqual(['cap-500', 'great', 'master', 'ultra']);
		expect(ivsKeyForCap(500)).toBe('cap-500');
	});

	it('has the tied-for-best patterns at that cap, at every level ceiling', () => {
		for (const level of BEST_IV_LEVELS) {
			const patterns = spreads['cap-500']![`level${level}` as const];
			expect(patterns.length).toBeGreaterThan(0);
			expect(patterns).toEqual(tiedTop1Patterns(stats.atk, stats.def, stats.hp, 500, level));
		}
	});

	it('fits every pattern under the cap at some level', () => {
		for (const { A, D, S } of spreads['cap-500']!.level50) {
			expect(calculateCP(stats.atk, A, stats.def, D, stats.hp, S, 0)).toBeLessThanOrEqual(500);
		}
	});

	it('is cap-bound far below level 50, so the Best Buddy ceiling changes nothing', () => {
		expect(spreads['cap-500']!.level51).toEqual(spreads['cap-500']!.level50);
	});

	it('leaves the permanent leagues as they are', () => {
		const without = computeBestIvSpreads(stats);
		expect(spreads.great).toEqual(without.great);
		expect(spreads.ultra).toEqual(without.ultra);
		expect(spreads.master).toEqual(without.master);
	});

	it('adds nothing without an extra cap, or for a cup at a permanent cap', () => {
		expect(Object.keys(computeBestIvSpreads(stats)).sort()).toEqual(Object.keys(LEAGUE_CAPS).sort());
		expect(Object.keys(computeBestIvSpreads(stats, [1500, 2500, 10000])).sort()).toEqual(
			Object.keys(LEAGUE_CAPS).sort()
		);
	});

	it('adds one entry for each distinct extra cap', () => {
		expect(Object.keys(computeBestIvSpreads(stats, [500, 1800, 500])).sort()).toEqual([
			'cap-1800',
			'cap-500',
			'great',
			'master',
			'ultra',
		]);
	});
});

describe('the purified spreads at a 500 CP cup', () => {
	it('are the tied-for-best purified patterns at that cap', () => {
		const purified = computeBestIvSpreadsPurified(stats, [500]);
		expect(purified['cap-500']!.level50).toEqual(
			tiedTop1PurifiedPatterns(stats.atk, stats.def, stats.hp, 500, (50 - 1) * 2)
		);
		expect(purified['cap-500']!.level50.length).toBeGreaterThan(0);
	});
});

describe('every species at a 500 CP cup', () => {
	const mon = (overrides: Partial<GameMasterPokemon>): GameMasterPokemon => ({
		dex: 1,
		speciesId: 'mon',
		speciesName: 'Mon',
		types: [PokemonTypes.Normal],
		fastMoves: [],
		chargedMoves: [],
		baseStats: stats,
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
	const dict: GameMasterData = {
		mon: mon({}),
		mon_shadow: mon({ speciesId: 'mon_shadow', isShadow: true }),
		mon_mega: mon({ speciesId: 'mon_mega', isMega: true, baseStats: { atk: 300, def: 300, hp: 300 } }),
		tiny: mon({ speciesId: 'tiny', baseStats: { atk: 50, def: 50, hp: 50 } }),
	};

	it('gets spreads at the cap, purified ones too for a Shadow or a Mega, whatever its size', () => {
		const result = computeBestIvSpreadsForAllSpecies(dict, [500]);
		for (const id of Object.keys(dict)) {
			expect(result[id].bestIvSpreads['cap-500']!.level50.length, id).toBeGreaterThan(0);
		}
		expect(result.mon.bestIvSpreadsPurified).toBeUndefined();
		expect(result.mon_shadow.bestIvSpreadsPurified!['cap-500']!.level50.length).toBeGreaterThan(0);
		expect(result.mon_mega.bestIvSpreadsPurified!['cap-500']!.level50.length).toBeGreaterThan(0);
	});

	it('is part of the file written for every species', () => {
		const metadata = computeSpeciesSearchMetadata(dict, [500, 1500]);
		for (const id of Object.keys(dict)) {
			expect(Object.keys(metadata[id].bestIvSpreads).sort(), id).toEqual(['cap-500', 'great', 'master', 'ultra']);
		}
	});

	it('is unchanged for the permanent leagues when no cup has another cap', () => {
		const metadata = computeSpeciesSearchMetadata(dict);
		for (const id of Object.keys(dict)) {
			expect(Object.keys(metadata[id].bestIvSpreads).sort(), id).toEqual(['great', 'master', 'ultra']);
		}
	});
});

describe('the rank-1 spread of a 500 CP cup, as the team builder picks it', () => {
	it('is the generated pattern with the highest numbers (Attack, then Defense, then HP), at the level the cap allows', () => {
		const patterns = computeBestIvSpreads(stats, [500])['cap-500']!.level50;
		const top = [...patterns].sort((a, b) => b.A - a.A || b.D - a.D || b.S - a.S)[0];
		const picked = pickBestIvs(patterns, stats, 500)!;
		expect(picked.slice(1)).toEqual([top.A, top.D, top.S]);
		const level = picked[0];
		const cp = (l: number) => calculateCP(stats.atk, top.A, stats.def, top.D, stats.hp, top.S, (l - 1) * 2);
		expect(cp(level)).toBeLessThanOrEqual(500);
		if (level < MAX_LEVEL) expect(cp(level + 0.5)).toBeGreaterThan(500);
	});

	it('exists for a species that is far over the cap at its best, down to the lowest levels', () => {
		const heavy = { atk: 300, def: 300, hp: 300 };
		const patterns = computeBestIvSpreads(heavy, [500])['cap-500']!.level50;
		expect(patterns.length).toBeGreaterThan(0);
		const picked = pickBestIvs(patterns, heavy, 500);
		expect(picked).toBeDefined();
		expect(picked![0]).toBeLessThan(20);
	});
});
