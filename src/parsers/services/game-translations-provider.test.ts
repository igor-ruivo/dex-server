import { describe, expect, it } from 'vitest';

import {
	buildGameTranslations,
	validateGameTranslations,
} from './game-translations-provider';
import type GameMasterTranslator from './gamemaster-translator';
import { AvailableLocales } from './gamemaster-translator';

const PUA_CHAR = '';

const REQUIRED_KEYS = [
	'filter_key_attack',
	'filter_key_defense',
	'pokedex_sort_hp',
	'general_cp',
	'favorite_filter_group_key',
	'filter_key_shadow',
	'filter_key_legendary',
	'filter_key_mythical',
	'filter_key_evolve_mega',
	'filter_key_ultra_beasts',
	'filter_key_bread',
	'filter_key_fusion',
	'filter_key_dough',
	'filter_key_any_background',
	'filter_key_special_background',
	'filter_key_shiny',
	'filter_key_costume',
	'filter_key_traded',
	'combat_great_league',
	'combat_ultra_league',
	'combat_master_league',
	'pokemon_info_cp',
	'raid',
	'filter_label_shadow',
	'pokedex_info_battle_fast_header',
	'pokedex_info_battle_charge_header',
	'tips_raid_tutorial_fast_attack_title',
	'tips_raid_tutorial_charged_attack_title',
	'elitefasttm.1_title',
	'elitechargedtm.1_title',
	'elite_raid_title',
	'meetup_check_in_raid',
	'filter_label_evolve_mega',
	'combat_move_attack_bonus_self',
	'combat_move_attack_bonus_target',
	'combat_move_attack_debuff_self',
	'combat_move_attack_debuff_target',
	'combat_move_defense_bonus_self',
	'combat_move_defense_bonus_target',
	'combat_move_defense_debuff_self',
	'combat_move_defense_debuff_target',
	'combat_ability_buff_chance',
	'weather_sunny',
	'weather_clear',
	'weather_rainy',
	'weather_partly_cloudy',
	'weather_overcast',
	'weather_windy',
	'weather_snow',
	'weather_fog',
	'friendship_level_1',
	'friendship_level_2',
	'friendship_level_3',
	'friendship_level_4',
	'mega_level_1',
	'mega_level_2',
	'mega_level_3',
	'settings_bgmode',
	'route_general_plural',
	...[
		'bug',
		'dark',
		'dragon',
		'electric',
		'fairy',
		'fighting',
		'fire',
		'flying',
		'ghost',
		'grass',
		'ground',
		'ice',
		'normal',
		'poison',
		'psychic',
		'rock',
		'steel',
		'water',
	].map((type) => `pokemon_type_${type}`),
];

/** A raw locale → key → value table where every locale mirrors EN with a
 *  locale prefix, except for whatever `overrides` supplies — enough to drive
 *  `buildGameTranslations` without a real `GameMasterTranslator`/network. */
function makeStubTranslator(
	overrides: Partial<
		Record<AvailableLocales, Partial<Record<string, string>>>
	> = {}
): GameMasterTranslator {
	const stub = {
		getRawString: (
			locale: AvailableLocales,
			key: string
		): string | undefined => {
			const override = overrides[locale]?.[key];
			if (override !== undefined) {
				return override;
			}
			if (!REQUIRED_KEYS.includes(key)) {
				return undefined;
			}
			return `${locale}:${key}`;
		},
	};
	return stub as unknown as GameMasterTranslator;
}

describe('buildGameTranslations', () => {
	it('produces a value for every locale, for every translation key and type', () => {
		const { translations, types } = buildGameTranslations(makeStubTranslator());
		expect(() => validateGameTranslations(translations, types)).not.toThrow();
	});

	it('uses the pinned spreadsheet override for hi/th search tokens even when the live dump looks clean', () => {
		// The stub's default (unclean-looking) `hi:filter_key_attack` value is
		// NOT corrupted (no PUA codepoints) — this proves the override wins
		// outright, not just as a corruption fallback.
		const { translations } = buildGameTranslations(makeStubTranslator());
		expect(translations.attackSearch[AvailableLocales.hi]).toBe('अटैक');
		expect(translations.attackSearch[AvailableLocales.th]).toBe('โจมตี');
	});

	it('uses the pinned spreadsheet override for hi/th type search tokens', () => {
		const { types } = buildGameTranslations(makeStubTranslator());
		expect(types.fire.search[AvailableLocales.hi]).toBe('फ़ायर');
		expect(types.fire.search[AvailableLocales.th]).toBe('ไฟ');
		// Display (not a search token) is unaffected by the override.
		expect(types.fire.display[AvailableLocales.hi]).toBe(
			`${AvailableLocales.hi}:pokemon_type_fire`
		);
	});

	it('lowercases search-token values but keeps display values as-is', () => {
		const { translations } = buildGameTranslations(
			makeStubTranslator({
				[AvailableLocales.de]: { filter_key_attack: 'ANGRIFF' },
			})
		);
		expect(translations.attackSearch[AvailableLocales.de]).toBe('angriff');
		expect(translations.raidDisplay[AvailableLocales.de]).toBe(
			`${AvailableLocales.de}:raid`
		);
	});

	it('falls back to EN when a locale value is PUA-corrupted', () => {
		const { translations } = buildGameTranslations(
			makeStubTranslator({
				[AvailableLocales.hi]: {
					combat_great_league: `Great${PUA_CHAR} League`,
				},
			})
		);
		expect(translations.greatLeagueLong[AvailableLocales.hi]).toBe(
			translations.greatLeagueLong[AvailableLocales.en]
		);
	});

	it('falls back to EN when a locale value is missing entirely', () => {
		const { translations } = buildGameTranslations(
			makeStubTranslator({
				[AvailableLocales.ru]: { raid: '' },
			})
		);
		expect(translations.raidDisplay[AvailableLocales.ru]).toBe(
			translations.raidDisplay[AvailableLocales.en]
		);
	});

	it('throws when EN itself has no value for a required key', () => {
		expect(() =>
			buildGameTranslations(
				makeStubTranslator({ [AvailableLocales.en]: { raid: '' } })
			)
		).toThrow(/EN itself has no value/);
	});

	it('derives league short forms with the correct per-locale strip rule', () => {
		const { translations } = buildGameTranslations(
			makeStubTranslator({
				[AvailableLocales.en]: {
					combat_great_league: 'Great League',
					combat_ultra_league: 'Ultra League',
					combat_master_league: 'Master League',
				},
				[AvailableLocales.ptbr]: {
					combat_great_league: 'Grande Liga',
					combat_ultra_league: 'Ultra-liga',
					combat_master_league: 'Liga Mestra',
				},
				[AvailableLocales.de]: {
					combat_great_league: 'Superliga',
					combat_ultra_league: 'Hyperliga',
					combat_master_league: 'Meisterliga',
				},
				[AvailableLocales.tr]: {
					combat_great_league: 'Süper Lig',
					combat_ultra_league: 'Ultra Lig',
					combat_master_league: 'Usta Ligi',
				},
			})
		);

		expect(translations.greatLeagueShort[AvailableLocales.en]).toBe('Great');
		expect(translations.masterLeagueShort[AvailableLocales.en]).toBe('Master');

		expect(translations.greatLeagueShort[AvailableLocales.ptbr]).toBe('Grande');
		expect(translations.ultraLeagueShort[AvailableLocales.ptbr]).toBe('Ultra');
		expect(translations.masterLeagueShort[AvailableLocales.ptbr]).toBe(
			'Mestra'
		);

		expect(translations.greatLeagueShort[AvailableLocales.de]).toBe('Super');
		expect(translations.ultraLeagueShort[AvailableLocales.de]).toBe('Hyper');
		expect(translations.masterLeagueShort[AvailableLocales.de]).toBe('Meister');

		expect(translations.greatLeagueShort[AvailableLocales.tr]).toBe('Süper');
		expect(translations.masterLeagueShort[AvailableLocales.tr]).toBe('Usta');
	});

	it('produces both a display and a lowercased search value for every type', () => {
		const { types } = buildGameTranslations(
			makeStubTranslator({
				[AvailableLocales.en]: { pokemon_type_fire: 'Fire' },
			})
		);
		expect(types.fire.display[AvailableLocales.en]).toBe('Fire');
		expect(types.fire.search[AvailableLocales.en]).toBe('fire');
	});
});

describe('validateGameTranslations', () => {
	it('throws when a translation key is missing a locale', () => {
		expect(() =>
			validateGameTranslations(
				{ raidDisplay: { [AvailableLocales.en]: 'raid' } },
				{}
			)
		).toThrow(/raidDisplay/);
	});

	it('throws when a type is missing a locale in either search or display', () => {
		expect(() =>
			validateGameTranslations(
				{},
				{
					fire: {
						display: { [AvailableLocales.en]: 'Fire' },
						search: {},
					},
				}
			)
		).toThrow(/types\.fire\.search/);
	});
});
