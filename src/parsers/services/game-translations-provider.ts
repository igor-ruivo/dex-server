import type GameMasterTranslator from './gamemaster-translator';
import { AvailableLocales } from './gamemaster-translator';

export type GameTranslations = Record<
	string,
	Partial<Record<AvailableLocales, string>>
>;

export interface TypeTranslations {
	search: Partial<Record<AvailableLocales, string>>;
	display: Partial<Record<AvailableLocales, string>>;
}

const ALL_LOCALES = Object.values(AvailableLocales);

// Data-mined APK string-table keys (PokeMiners/pogo_assets `i18n_<locale>.json`,
// same source `gamemaster-translator.ts` already fetches) for every
// go-pokedex GameTranslator concept — every one of these is sourced live
// per locale, nothing here is a hardcoded/static translation. Most are
// `filter_key_*`, the literal, lowercase token typed into the in-game search
// bar; `hpSearch`/`cpSearch`/`favorite` don't have a `filter_key_*` entry of
// their own so they're sourced from the nearest confirmed equivalent
// (`pokedex_sort_hp`/`general_cp`/`favorite_filter_group_key`) and
// lowercased the same way as the rest, below.
const SEARCH_TOKEN_SOURCE_KEYS: Record<string, string> = {
	attackSearch: 'filter_key_attack',
	defenseSearch: 'filter_key_defense',
	hpSearch: 'pokedex_sort_hp',
	cpSearch: 'general_cp',
	shadowSearch: 'filter_key_shadow',
	legendary: 'filter_key_legendary',
	mythical: 'filter_key_mythical',
	megaEvolve: 'filter_key_evolve_mega',
	ultraBeast: 'filter_key_ultra_beasts',
	favorite: 'favorite_filter_group_key',
	dynamaxSearch: 'filter_key_bread',
	fusionSearch: 'filter_key_fusion',
	gigantamaxSearch: 'filter_key_dough',
	backgroundSearch: 'filter_key_any_background',
	specialBackgroundSearch: 'filter_key_special_background',
	shinySearch: 'filter_key_shiny',
	costumeSearch: 'filter_key_costume',
	tradedSearch: 'filter_key_traded',
};

const DISPLAY_SOURCE_KEYS: Record<string, string> = {
	greatLeagueLong: 'combat_great_league',
	ultraLeagueLong: 'combat_ultra_league',
	masterLeagueLong: 'combat_master_league',
	cpDisplay: 'pokemon_info_cp',
	raidDisplay: 'raid',
	shadowDisplay: 'filter_label_shadow',
	fastAttackHeader: 'pokedex_info_battle_fast_header',
	chargedAttackHeader: 'pokedex_info_battle_charge_header',
};

const POKEMON_TYPES = [
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
] as const;

// The private-use-area codepoints Niantic's client string tables use as a
// font-substitution hack for certain Hindi/Thai conjuncts — confirmed by
// diffing this dump against go-pokedex's previously hand-verified Hindi/Thai
// values, which come out correctly formed while the raw dump doesn't for the
// same keys. Not locale-specific in principle (any locale's dump could carry
// this), so it's checked for every locale, not just hi/th.
const isPrivateUseCodepoint = (codePoint: number): boolean =>
	(codePoint >= 0xe000 && codePoint <= 0xf8ff) ||
	(codePoint >= 0xf0000 && codePoint <= 0xffffd) ||
	(codePoint >= 0x100000 && codePoint <= 0x10fffd);

const isCorrupted = (value: string): boolean =>
	[...value].some((char) => isPrivateUseCodepoint(char.codePointAt(0) ?? 0));

/** Resolves one data-mined key across every locale, falling back to the EN
 *  value whenever a locale's own value is missing or PUA-corrupted — logs
 *  every fallback so a real (non-corruption) gap in the dump is still
 *  visible, not silently absorbed. */
function resolveAcrossLocales(
	translator: GameMasterTranslator,
	translationKey: string,
	sourceKey: string
): Partial<Record<AvailableLocales, string>> {
	const enValue = translator.getRawString(AvailableLocales.en, sourceKey);
	if (!enValue) {
		throw new Error(
			`[game-translations-provider] EN itself has no value for data-mined key "${sourceKey}" (translation key "${translationKey}") — the key name is wrong or PokeMiners removed/renamed it.`
		);
	}

	const result: Partial<Record<AvailableLocales, string>> = {};
	for (const locale of ALL_LOCALES) {
		const raw = translator.getRawString(locale, sourceKey);
		if (raw && !isCorrupted(raw)) {
			result[locale] = raw;
			continue;
		}

		console.log(
			`[game-translations-provider] ${locale}/${translationKey} (${sourceKey}) ${raw ? 'is corrupted (PUA font-hack codepoints)' : 'is missing'} — falling back to EN.`
		);
		result[locale] = enValue;
	}

	return result;
}

const LEAGUE_TIERS = ['great', 'ultra', 'master'] as const;
type LeagueTier = (typeof LEAGUE_TIERS)[number];

// Every locale's own word for "League" isn't a clean universal substring —
// word order and inflection both vary (see the per-locale comments) — so
// each locale needs its own strip rule per tier rather than one generic
// regex. Verified by hand against each locale's `combat_<tier>_league`
// value at the time this was written; re-check any locale whose long-form
// wording changes upstream.
const LEAGUE_SHORT_FORM_STRIP: Record<
	AvailableLocales,
	Record<LeagueTier, { side: 'prefix' | 'suffix'; text: string }>
> = {
	[AvailableLocales.en]: {
		great: { side: 'suffix', text: ' League' },
		ultra: { side: 'suffix', text: ' League' },
		master: { side: 'suffix', text: ' League' },
	},
	// "Grande Liga" / "Ultra-liga" / "Liga Mestra" — word order for Master
	// flips relative to Great/Ultra.
	[AvailableLocales.ptbr]: {
		great: { side: 'suffix', text: ' Liga' },
		ultra: { side: 'suffix', text: '-liga' },
		master: { side: 'prefix', text: 'Liga ' },
	},
	// "Superliga" / "Hyperliga" / "Meisterliga" — true compounds, but "liga"
	// is still a clean literal suffix of each.
	[AvailableLocales.de]: {
		great: { side: 'suffix', text: 'liga' },
		ultra: { side: 'suffix', text: 'liga' },
		master: { side: 'suffix', text: 'liga' },
	},
	// "Liga Super Ball" / "Liga Ultra Ball" / "Liga Master Ball" — Spanish
	// names these after the matching Poké Ball tier, not a plain adjective.
	[AvailableLocales.es]: {
		great: { side: 'prefix', text: 'Liga ' },
		ultra: { side: 'prefix', text: 'Liga ' },
		master: { side: 'prefix', text: 'Liga ' },
	},
	[AvailableLocales.esMx]: {
		great: { side: 'prefix', text: 'Liga ' },
		ultra: { side: 'prefix', text: 'Liga ' },
		master: { side: 'prefix', text: 'Liga ' },
	},
	[AvailableLocales.fr]: {
		great: { side: 'prefix', text: 'Ligue ' },
		ultra: { side: 'prefix', text: 'Ligue ' },
		master: { side: 'prefix', text: 'Ligue ' },
	},
	// Hindi's own long-form value is frequently PUA-corrupted in the dump, so
	// this locale ends up deriving its short form off the EN fallback most of
	// the time anyway (see `resolveAcrossLocales`) — this rule only applies
	// on the rare clean value.
	[AvailableLocales.hi]: {
		great: { side: 'suffix', text: ' League' },
		ultra: { side: 'suffix', text: ' League' },
		master: { side: 'suffix', text: ' League' },
	},
	[AvailableLocales.id]: {
		great: { side: 'prefix', text: 'Liga ' },
		ultra: { side: 'prefix', text: 'Liga ' },
		master: { side: 'prefix', text: 'Liga ' },
	},
	[AvailableLocales.it]: {
		great: { side: 'prefix', text: 'Lega ' },
		ultra: { side: 'prefix', text: 'Lega ' },
		master: { side: 'prefix', text: 'Lega ' },
	},
	[AvailableLocales.ja]: {
		great: { side: 'suffix', text: 'リーグ' },
		ultra: { side: 'suffix', text: 'リーグ' },
		master: { side: 'suffix', text: 'リーグ' },
	},
	[AvailableLocales.ko]: {
		great: { side: 'suffix', text: '리그' },
		ultra: { side: 'suffix', text: '리그' },
		master: { side: 'suffix', text: '리그' },
	},
	// "Великая Лига" / "Ультралига" / "Мастер-Лига" — three different
	// join styles (space, none, hyphen) for the same word.
	[AvailableLocales.ru]: {
		great: { side: 'suffix', text: ' Лига' },
		ultra: { side: 'suffix', text: 'лига' },
		master: { side: 'suffix', text: '-Лига' },
	},
	// Same corruption caveat as Hindi (see above).
	[AvailableLocales.th]: {
		great: { side: 'suffix', text: ' League' },
		ultra: { side: 'suffix', text: ' League' },
		master: { side: 'suffix', text: ' League' },
	},
	// "Süper Lig" / "Ultra Lig" / "Usta Ligi" — Master's "Ligi" carries a
	// possessive suffix the other two don't.
	[AvailableLocales.tr]: {
		great: { side: 'suffix', text: ' Lig' },
		ultra: { side: 'suffix', text: ' Lig' },
		master: { side: 'suffix', text: ' Ligi' },
	},
	[AvailableLocales.zhHant]: {
		great: { side: 'suffix', text: '聯盟' },
		ultra: { side: 'suffix', text: '聯盟' },
		master: { side: 'suffix', text: '聯盟' },
	},
};

function deriveLeagueShortForm(
	longForm: string,
	locale: AvailableLocales,
	tier: LeagueTier
): string {
	const rule = LEAGUE_SHORT_FORM_STRIP[locale][tier];
	if (rule.side === 'suffix' && longForm.endsWith(rule.text)) {
		return longForm.slice(0, longForm.length - rule.text.length);
	}
	if (rule.side === 'prefix' && longForm.startsWith(rule.text)) {
		return longForm.slice(rule.text.length);
	}

	// The long form didn't match its own locale's expected pattern (e.g. an
	// EN fallback value going through a non-EN strip rule) — falling back
	// to the EN strip rule against the EN long form keeps this from ever
	// silently returning the untouched long form as a "short" one.
	const enRule = LEAGUE_SHORT_FORM_STRIP[AvailableLocales.en][tier];
	return longForm.endsWith(enRule.text)
		? longForm.slice(0, longForm.length - enRule.text.length)
		: longForm;
}

export function buildGameTranslations(translator: GameMasterTranslator): {
	translations: GameTranslations;
	types: Record<string, TypeTranslations>;
} {
	const translations: GameTranslations = {};

	for (const [translationKey, sourceKey] of Object.entries(
		SEARCH_TOKEN_SOURCE_KEYS
	)) {
		const resolved = resolveAcrossLocales(
			translator,
			translationKey,
			sourceKey
		);
		translations[translationKey] = Object.fromEntries(
			Object.entries(resolved).map(([locale, value]) => [
				locale,
				value.toLowerCase(),
			])
		);
	}

	for (const [translationKey, sourceKey] of Object.entries(
		DISPLAY_SOURCE_KEYS
	)) {
		translations[translationKey] = resolveAcrossLocales(
			translator,
			translationKey,
			sourceKey
		);
	}

	const longForms: Record<
		LeagueTier,
		Partial<Record<AvailableLocales, string>>
	> = {
		great: translations.greatLeagueLong,
		ultra: translations.ultraLeagueLong,
		master: translations.masterLeagueLong,
	};
	for (const tier of LEAGUE_TIERS) {
		const shortForm: Partial<Record<AvailableLocales, string>> = {};
		for (const locale of ALL_LOCALES) {
			const long = longForms[tier][locale];
			if (long) {
				shortForm[locale] = deriveLeagueShortForm(long, locale, tier);
			}
		}
		translations[`${tier}LeagueShort`] = shortForm;
	}

	const types: Record<string, TypeTranslations> = {};
	for (const type of POKEMON_TYPES) {
		const display = resolveAcrossLocales(
			translator,
			`type.${type}`,
			`pokemon_type_${type}`
		);
		const search = Object.fromEntries(
			Object.entries(display).map(([locale, value]) => [
				locale,
				value.toLowerCase(),
			])
		);
		types[type] = { display, search };
	}

	return { translations, types };
}

/** Every value above is either data-mined-and-fallback-guaranteed or a
 *  hand-maintained static constant — both are supposed to cover all 15
 *  locales unconditionally, so any gap here is a real bug in this file
 *  (e.g. a league-short-form strip rule that silently produced `undefined`),
 *  not a translation gap to shrug off. Throws (failing the generate job)
 *  rather than shipping a hole. */
export function validateGameTranslations(
	translations: GameTranslations,
	types: Record<string, TypeTranslations>
): void {
	const errors: Array<string> = [];

	const checkRecord = (
		record: Partial<Record<AvailableLocales, string>>,
		label: string
	): void => {
		for (const locale of ALL_LOCALES) {
			if (!record[locale]) {
				errors.push(`${label}: missing/empty value for locale "${locale}".`);
			}
		}
	};

	for (const [key, record] of Object.entries(translations)) {
		checkRecord(record, `translations.${key}`);
	}
	for (const [type, { search, display }] of Object.entries(types)) {
		checkRecord(search, `types.${type}.search`);
		checkRecord(display, `types.${type}.display`);
	}

	if (errors.length > 0) {
		throw new Error(
			`Game translations QA failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n` +
				errors.map((e) => `  - ${e}`).join('\n')
		);
	}
}
