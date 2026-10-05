import { describe, expect, it } from 'vitest';

import type { GameMasterData } from '../../../types/pokemon';
import { currentMaxBattleBosses, markMaxShiny } from './MaxBattlesParser';

const dictionary = Object.fromEntries(
	[
		'abra',
		'cinderace',
		'duraludon',
		'toxtricity',
		'urshifu_rapid_strike',
		'urshifu_shadow',
		'moltres',
	].map((id) => [id, {}])
) as unknown as GameMasterData;

const boss = (pokemonId: string, tier: string) => ({ pokemonId, tier });

describe('the current Max Battle bosses of Pokebattler', () => {
	it('keeps the plain tiers, as base species with their form and tier, and drops the legacy and future ones', () => {
		const result = currentMaxBattleBosses(
			{
				ABRA: boss('ABRA', 'RAID_LEVEL_1_MAX'),
				CINDERACE_GIGANTAMAX: boss('CINDERACE_GIGANTAMAX', 'RAID_LEVEL_6_MAX'),
				DURALUDON: boss('DURALUDON', 'RAID_LEVEL_4_MAX'),
				MOLTRES: boss('MOLTRES', 'RAID_LEVEL_5_MAX_LEGACY'),
				URSHIFU_RAPID_STRIKE_GIGANTAMAX: boss(
					'URSHIFU_RAPID_STRIKE_GIGANTAMAX',
					'RAID_LEVEL_6_MAX_FUTURE'
				),
			},
			dictionary
		);
		expect(result).toEqual([
			{ speciesId: 'abra', kind: 'dynamax', tier: '1', shiny: false },
			{ speciesId: 'duraludon', kind: 'dynamax', tier: '4', shiny: false },
			{ speciesId: 'cinderace', kind: 'gigantamax', tier: '6', shiny: false },
		]);
	});

	it('finds the species of a boss whose id is only a form of it', () => {
		const result = currentMaxBattleBosses(
			{ URSHIFU: boss('URSHIFU', 'RAID_LEVEL_3_MAX') },
			dictionary
		);
		expect(result.map((e) => e.speciesId)).toEqual(['urshifu_rapid_strike']);
	});

	it('throws on a boss the game master has no species for, instead of skipping it', () => {
		expect(() =>
			currentMaxBattleBosses(
				{ NOBODY: boss('NOBODY', 'RAID_LEVEL_3_MAX') },
				dictionary
			)
		).toThrow(/NOBODY/);
	});
});

describe('shiny on the current Max Battle bosses', () => {
	it('marks the Pokémon, in the same form, that another source says can be shiny', () => {
		const entries = [
			{ speciesId: 'abra', kind: 'dynamax', tier: '1', shiny: false },
			{ speciesId: 'cinderace', kind: 'gigantamax', tier: '6', shiny: false },
			{ speciesId: 'cinderace', kind: 'dynamax', tier: '1', shiny: false },
		];
		expect(
			markMaxShiny(entries, [
				[{ speciesId: 'cinderace', kind: 'gigantamax', shiny: true }],
				[{ speciesId: 'abra', kind: 'dynamax', shiny: false }],
			]).map((e) => e.shiny)
		).toEqual([false, true, false]);
	});
});
