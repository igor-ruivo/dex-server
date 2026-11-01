import { describe, expect, it } from 'vitest';

import { pickBestIvs } from '../parsers/teams/team-builder-parser';
import type {
	GameMasterData,
	GameMasterPokemon,
} from '../parsers/types/pokemon';
import {
	BEST_IV_LEVELS,
	calculateCP,
	computeBestIvSpreads,
	computeBestIvSpreadsForAllSpecies,
	SUPER_MEGA_BEST_IV_LEVEL,
	tiedTop1Patterns,
} from './best-iv-spread-calculator';

/**
 * A Super Max Mega's level ceiling is 52, not 50. That only changes its best spread when it can fit a capped league's CP at
 * level 50 (a light one, like Mega Sableye) — so those species ship a level-52 table of their own, and nobody else does.
 */
const light = { atk: 180, def: 200, hp: 150 };

const species = (
	speciesId: string,
	baseStats: { atk: number; def: number; hp: number },
	isSuperMega: boolean
) =>
	({
		speciesId,
		baseStats,
		isSuperMega,
		isShadow: false,
		isMega: true,
	}) as unknown as GameMasterPokemon;

describe('level-52 best IV spreads for Super Max Megas', () => {
	it('are the tied-for-best patterns of a level ceiling of 52', () => {
		const spreads = computeBestIvSpreads(light, [500], true);
		for (const [key, cap] of [
			['great', 1500],
			['ultra', 2500],
			['master', Number.MAX_VALUE],
			['cap-500', 500],
		] as const) {
			expect(spreads[key]!.level52).toEqual(
				tiedTop1Patterns(
					light.atk,
					light.def,
					light.hp,
					cap,
					SUPER_MEGA_BEST_IV_LEVEL
				)
			);
		}
	});

	it('really differ from level 50’s where the species fits Ultra League at level 50', () => {
		const spreads = computeBestIvSpreads(light, [], true);
		expect(spreads.ultra.level50).toEqual([{ A: 8, D: 15, S: 15 }]);
		expect(spreads.ultra.level52).toEqual([{ A: 4, D: 14, S: 15 }]);
	});

	it('are only shipped for a Super Max Mega, and leave the other two levels untouched', () => {
		const gameMaster: GameMasterData = {
			super_mega: species('super_mega', light, true),
			plain_mega: species('plain_mega', light, false),
		};
		const result = computeBestIvSpreadsForAllSpecies(gameMaster);
		expect(result.plain_mega.bestIvSpreads.ultra.level52).toBeUndefined();
		expect(Object.keys(result.super_mega.bestIvSpreads.ultra).sort()).toEqual([
			'level50',
			'level51',
			'level52',
		]);
		for (const level of BEST_IV_LEVELS) {
			expect(result.super_mega.bestIvSpreads.ultra[`level${level}`]).toEqual(
				result.plain_mega.bestIvSpreads.ultra[`level${level}`]
			);
		}
	});

	it('are picked up to level 52, and the level is the highest one under the cap', () => {
		const patterns = computeBestIvSpreads(light, [], true).master.level52!;
		const [level, atk, def, hp] = pickBestIvs(
			patterns,
			light,
			Number.MAX_VALUE,
			SUPER_MEGA_BEST_IV_LEVEL
		)!;
		expect([level, atk, def, hp]).toEqual([52, 15, 15, 15]);

		const ultra = computeBestIvSpreads(light, [], true).ultra.level52!;
		const [ultraLevel, a, d, s] = pickBestIvs(
			ultra,
			light,
			2500,
			SUPER_MEGA_BEST_IV_LEVEL
		)!;
		const cpAt = (l: number) =>
			calculateCP(light.atk, a, light.def, d, light.hp, s, (l - 1) * 2);
		expect(cpAt(ultraLevel)).toBeLessThanOrEqual(2500);
		expect(ultraLevel).toBeGreaterThan(50);
		expect(cpAt(ultraLevel + 0.5)).toBeGreaterThan(2500);
	});
});
