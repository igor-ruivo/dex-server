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

// Spreadsheet-verified (APK 0.429.1 audit, pre-dating this file — the same
// source that originally seeded go-pokedex's GameTranslator.ts by hand)
// overrides for hi/th search tokens specifically. PokeMiners' live dump
// corrupts most Hindi/Thai conjunct clusters via a PUA font-hack (see
// `isCorrupted`'s own comment), and unlike a display label, a corrupted or
// EN-fallback *search token* is a functionally broken search for that
// locale's players — they'd be typing a real Hindi/Thai word into a search
// bar that only recognizes the (unreadable, or wrong-language) alternative.
// Pinned here rather than re-derived live; takes priority over the dump
// outright, not just as a corruption fallback.
const SEARCH_TOKEN_OVERRIDES: Record<
	string,
	Partial<Record<AvailableLocales, string>>
> = {
	attackSearch: {
		[AvailableLocales.hi]: 'अटैक',
		[AvailableLocales.th]: 'โจมตี',
	},
	defenseSearch: {
		[AvailableLocales.hi]: 'डिफ़ेंस',
		[AvailableLocales.th]: 'ป้องกัน',
	},
	hpSearch: { [AvailableLocales.hi]: 'hp', [AvailableLocales.th]: 'hp' },
	cpSearch: { [AvailableLocales.hi]: 'cp', [AvailableLocales.th]: 'cp' },
	shadowSearch: {
		[AvailableLocales.hi]: 'शैडो',
		[AvailableLocales.th]: 'ชาโดว์',
	},
	legendary: {
		[AvailableLocales.hi]: 'लेजेंडरी',
		[AvailableLocales.th]: 'ตำนาน',
	},
	mythical: { [AvailableLocales.hi]: 'मिथिकल', [AvailableLocales.th]: 'มายา' },
	megaEvolve: {
		[AvailableLocales.hi]: 'मेगा एवॉल्व',
		[AvailableLocales.th]: 'วิวัฒนาการเมก้า',
	},
	ultraBeast: {
		[AvailableLocales.hi]: 'अल्ट्राबीस्ट',
		[AvailableLocales.th]: 'อัลตร้าบีสต์',
	},
	favorite: {
		[AvailableLocales.hi]: 'पसंदीदा',
		[AvailableLocales.th]: 'รายการโปรด',
	},
	dynamaxSearch: {
		[AvailableLocales.hi]: 'डायनामैक्स',
		[AvailableLocales.th]: 'ไดแมกซ์',
	},
	fusionSearch: {
		[AvailableLocales.hi]: 'फ़्यूज़न',
		[AvailableLocales.th]: 'รวมร่าง',
	},
	gigantamaxSearch: {
		[AvailableLocales.hi]: 'जायगैंटामैक्स',
		[AvailableLocales.th]: 'กิกะแมกซ์',
	},
	backgroundSearch: {
		[AvailableLocales.hi]: 'बैकग्राउंड',
		[AvailableLocales.th]: 'พื้นหลัง',
	},
	specialBackgroundSearch: {
		[AvailableLocales.hi]: 'स्पेशलबैकग्राउंड',
		[AvailableLocales.th]: 'พื้นหลังพิเศษ',
	},
	shinySearch: {
		[AvailableLocales.hi]: 'शाइनी',
		[AvailableLocales.th]: 'สีแตกต่าง',
	},
	costumeSearch: {
		[AvailableLocales.hi]: 'कॉस्ट्यूम',
		[AvailableLocales.th]: 'เครื่องแต่งกาย',
	},
	tradedSearch: {
		[AvailableLocales.hi]: 'ट्रेड किये गए',
		[AvailableLocales.th]: 'แลกเปลี่ยน',
	},
};

// Same reasoning and source as `SEARCH_TOKEN_OVERRIDES` above, for the 18
// Pokémon-type search tokens (e.g. typing "fire" to filter) — these are
// derived from the type *display* name (lowercased), not resolved
// independently, so they're applied after that derivation instead of
// through `resolveAcrossLocales`; see `buildGameTranslations` below.
const TYPE_SEARCH_OVERRIDES: Record<
	string,
	Partial<Record<AvailableLocales, string>>
> = {
	bug: { [AvailableLocales.hi]: 'बग', [AvailableLocales.th]: 'แมลง' },
	dark: { [AvailableLocales.hi]: 'डार्क', [AvailableLocales.th]: 'ความมืด' },
	dragon: { [AvailableLocales.hi]: 'ड्रैगन', [AvailableLocales.th]: 'มังกร' },
	electric: {
		[AvailableLocales.hi]: 'इलेक्ट्रिक',
		[AvailableLocales.th]: 'ไฟฟ้า',
	},
	fairy: { [AvailableLocales.hi]: 'फ़ेरी', [AvailableLocales.th]: 'แฟรี่' },
	fighting: {
		[AvailableLocales.hi]: 'फ़ाइटिंग',
		[AvailableLocales.th]: 'ต่อสู้',
	},
	fire: { [AvailableLocales.hi]: 'फ़ायर', [AvailableLocales.th]: 'ไฟ' },
	flying: { [AvailableLocales.hi]: 'फ़्लाइंग', [AvailableLocales.th]: 'บิน' },
	ghost: { [AvailableLocales.hi]: 'घोस्ट', [AvailableLocales.th]: 'ผี' },
	grass: { [AvailableLocales.hi]: 'ग्रास', [AvailableLocales.th]: 'หญ้า' },
	ground: { [AvailableLocales.hi]: 'ग्राउंड', [AvailableLocales.th]: 'ดิน' },
	ice: { [AvailableLocales.hi]: 'आइस', [AvailableLocales.th]: 'น้ำแข็ง' },
	normal: { [AvailableLocales.hi]: 'नॉर्मल', [AvailableLocales.th]: 'ปกติ' },
	poison: { [AvailableLocales.hi]: 'पॉइज़न', [AvailableLocales.th]: 'พิษ' },
	psychic: {
		[AvailableLocales.hi]: 'साइकिक',
		[AvailableLocales.th]: 'พลังจิต',
	},
	rock: { [AvailableLocales.hi]: 'रॉक', [AvailableLocales.th]: 'หิน' },
	steel: { [AvailableLocales.hi]: 'स्टील', [AvailableLocales.th]: 'โลหะ' },
	water: { [AvailableLocales.hi]: 'वॉटर', [AvailableLocales.th]: 'น้ำ' },
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
	// Plural forms — for a section header listing multiple moves at once
	// (e.g. "Fast Attacks" above a whole movepool), as opposed to the
	// singular forms above (e.g. a single move's own detail-screen header).
	// Several locales (English, Portuguese, …) inflect these differently
	// from the singular, so this isn't safe to derive by just appending an
	// "s" — sourced as its own confirmed data-mined key instead.
	fastAttackHeaderPlural: 'tips_raid_tutorial_fast_attack_title',
	chargedAttackHeaderPlural: 'tips_raid_tutorial_charged_attack_title',
	// The actual TM item names — used as an "Elite {Fast,Charged} TM" badge
	// on a move only obtainable that way (no bare "Elite" badge exists
	// in-game; these two qualified names are what the game actually calls
	// them).
	eliteFastTm: 'elitefasttm.1_title',
	eliteChargedTm: 'elitechargedtm.1_title',
	// The raid difficulty tier (distinct from the Elite TM move badges above).
	eliteRaidTier: 'elite_raid_title',
	// "Can Mega Evolve" — the actual in-game filter label for this concept
	// (go-pokedex previously called this "Mega Evolvable", its own invented
	// phrasing).
	megaEvolvableDisplay: 'filter_label_evolve_mega',
	// Every other MassDelete/search-filter checkbox's own display label —
	// distinct from the lowercase search-token versions above (e.g.
	// `legendary` is the typed keyword "legendary"; `legendaryDisplay` is the
	// properly-cased "Legendary" shown next to the checkbox). `costume`'s
	// real in-game label is "Event" — that's what the same filter shows in
	// the game itself, not a mismatch.
	favoriteDisplay: 'favorite_filter_group_key',
	legendaryDisplay: 'filter_label_legendary',
	mythicalDisplay: 'filter_label_mythical',
	ultraBeastDisplay: 'filter_key_ultra_beast',
	dynamaxDisplay: 'filter_label_dynamax',
	fusionDisplay: 'fusion_feature_name',
	gigantamaxDisplay: 'filter_label_gigantamax',
	shinyDisplay: 'filter_label_shiny',
	costumeDisplay: 'filter_label_costume',
	// "Location Background" — the base (non-special) filter concept; no
	// dedicated `filter_label_any_background` key exists, but this one is the
	// actual in-game title-cased name for the same "background" search token
	// `backgroundSearch` above already uses. `location_card_tutorial_message`
	// is the in-app tutorial toast body ("You got a Location Background!
	// These are rare backgrounds you may receive when catching Pokémon at
	// special locations...") — the closest thing to a plain-language
	// description that exists in the dump for this concept.
	backgroundDisplay: 'filter_label_location_card',
	backgroundDescription: 'location_card_tutorial_message',
	// "Special Background" filter header + its own FTUE tutorial body.
	specialBackgroundDisplay: 'special_background_filter_header',
	specialBackgroundDescription: 'special_background_ftue_body',

	// PvP charged-move stat-stage buff/debuff badges — the actual short
	// labels Pokémon GO's own move-detail screen shows (e.g. "ATTACK DROP"),
	// not a constructed sentence — see go-pokedex's `buffText()` for why a
	// sentence built from independently-translated words was replaced with
	// these badges instead (word order/grammar isn't safe to assemble
	// per-locale from parts).
	attackBoostSelf: 'combat_move_attack_bonus_self',
	attackBoostTarget: 'combat_move_attack_bonus_target',
	attackDropSelf: 'combat_move_attack_debuff_self',
	attackDropTarget: 'combat_move_attack_debuff_target',
	defenseBoostSelf: 'combat_move_defense_bonus_self',
	defenseBoostTarget: 'combat_move_defense_bonus_target',
	defenseDropSelf: 'combat_move_defense_debuff_self',
	defenseDropTarget: 'combat_move_defense_debuff_target',
	buffChance: 'combat_ability_buff_chance',

	// Weather boost conditions (Counters tab). go-pokedex shows "Sunny/Clear"
	// as one combined label — sourced as two separate keys here since that
	// combining is a go-pokedex display choice, not something to bake in.
	weatherSunny: 'weather_sunny',
	weatherClear: 'weather_clear',
	weatherRainy: 'weather_rainy',
	weatherPartlyCloudy: 'weather_partly_cloudy',
	weatherCloudy: 'weather_overcast',
	weatherWindy: 'weather_windy',
	weatherSnow: 'weather_snow',
	weatherFog: 'weather_fog',

	// Friendship ladder (Counters tab raid-bonus selector). Levels 1-4 only —
	// level 0 ("no bonus") and a 6th "Best Friend Forever" tier go-pokedex
	// also shows have no data-mined equivalent (the latter looks like a very
	// recently added tier PokeMiners hasn't dumped yet); both stay
	// site-only English per an explicit call on this.
	friendshipGood: 'friendship_level_1',
	friendshipGreat: 'friendship_level_2',
	friendshipUltra: 'friendship_level_3',
	friendshipBest: 'friendship_level_4',

	// Mega Level ladder (Counters tab mega-aura selector). Only 3 confirmed
	// tiers exist in the dump; go-pokedex's 4th ("Super Max") has no
	// data-mined equivalent — same reasoning as the friendship 6th tier
	// above, stays site-only English.
	megaLevelBase: 'mega_level_1',
	megaLevelHigh: 'mega_level_2',
	megaLevelMax: 'mega_level_3',

	// Egg-comment labels (Eggs tab groupings). `rewardsDisplay`/`friendDisplay`/
	// `giftDisplay` are combined with these (and each other) below, into the
	// actual scraped LeekDuck comment phrases ("Adventure Sync Rewards",
	// "Route Rewards", "From Friend Gifts") — see EGG_COMMENT_TRANSLATION_KEYS.
	adventureSync: 'settings_bgmode',
	routes: 'route_general_plural',
	rewardsDisplay: 'badge_detail_reward_header',
	friendDisplay: 'friend_singular',
	giftDisplay: 'friendslist_sort_gift',

	// "Pokémon Spotlight Hour" — replaces the hand-typed, unverified
	// SPOTLIGHT_HOUR_TITLE_TRANSLATIONS map in gamemaster-translator.ts.
	spotlightHour: 'spotlight_hour_event_name',

	// "Mega" — go-pokedex combines this with `legendaryDisplay`/other concept
	// words client-side (e.g. "Legendary Mega") rather than baking every
	// combination in here; see GameTranslator.ts call sites.
	megaDisplay: 'pokedex_mode_name_mega',
	// "PRIMAL" — the short badge-style word (as opposed to
	// `pokedex_mode_name_primal`'s "Primal Reversion", a full ability-name
	// phrase); matches the raid boss tier label's existing short style.
	primalDisplay: 'pokedex_info_variant_mega_primal',

	// Team GO Rocket grunt/leader display names — go-pokedex combines
	// `gruntDisplay` with a type name for "<Type> Grunt" cards; the four NPC
	// names are already the full display name each (e.g. `sierraDisplay`'s
	// value already reads "Leader Sierra"/"Boss Sierra" per locale, not just
	// "Sierra" — no separate "Leader" word to source).
	gruntDisplay: 'combat_grunt_name',
	giovanniDisplay: 'combat_giovanni_name',
	sierraDisplay: 'combat_sierra_name',
	arloDisplay: 'combat_arlo_name',
	cliffDisplay: 'combat_cliff_name',
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
 *  visible, not silently absorbed. `manualOverrides` (when given) wins
 *  outright for whichever locales it covers, before the live dump is even
 *  consulted — see `SEARCH_TOKEN_OVERRIDES`'s own comment for why search
 *  tokens specifically can't settle for an EN fallback the way a display
 *  label can. */
function resolveAcrossLocales(
	translator: GameMasterTranslator,
	translationKey: string,
	sourceKey: string,
	manualOverrides?: Partial<Record<AvailableLocales, string>>
): Partial<Record<AvailableLocales, string>> {
	const enValue = translator.getRawString(AvailableLocales.en, sourceKey);
	if (!enValue) {
		throw new Error(
			`[game-translations-provider] EN itself has no value for data-mined key "${sourceKey}" (translation key "${translationKey}") — the key name is wrong or PokeMiners removed/renamed it.`
		);
	}

	const result: Partial<Record<AvailableLocales, string>> = {};
	for (const locale of ALL_LOCALES) {
		const override = manualOverrides?.[locale];
		if (override) {
			result[locale] = override;
			continue;
		}

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
			sourceKey,
			SEARCH_TOKEN_OVERRIDES[translationKey]
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

	// Combined egg-comment phrases (see localizeEggComment/
	// EGG_COMMENT_TRANSLATION_KEYS below) — built from two or three
	// DISPLAY_SOURCE_KEYS entries each, matching the literal scraped LeekDuck
	// comment text word-for-word.
	const capitalizeRecord = (
		rec: Partial<Record<AvailableLocales, string>>
	): Partial<Record<AvailableLocales, string>> =>
		Object.fromEntries(
			Object.entries(rec).map(([locale, value]) => [
				locale,
				value.charAt(0).toUpperCase() + value.slice(1),
			])
		);
	const combine = (
		...parts: Array<Partial<Record<AvailableLocales, string>>>
	): Partial<Record<AvailableLocales, string>> => {
		const out: Partial<Record<AvailableLocales, string>> = {};
		for (const locale of ALL_LOCALES) {
			const words = parts.map((p) => p[locale]).filter((w): w is string => !!w);
			if (words.length === parts.length) {
				out[locale] = words.join(' ');
			}
		}
		return out;
	};
	translations.adventureSyncRewards = combine(
		translations.adventureSync,
		translations.rewardsDisplay
	);
	translations.routeRewards = combine(
		translations.routes,
		translations.rewardsDisplay
	);
	translations.friendGiftGroup = combine(
		capitalizeRecord(translations.friendDisplay),
		translations.giftDisplay
	);

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
		const search: Partial<Record<AvailableLocales, string>> =
			Object.fromEntries(
				Object.entries(display).map(([locale, value]) => [
					locale,
					value.toLowerCase(),
				])
			);
		const overrides = TYPE_SEARCH_OVERRIDES[type];
		if (overrides) {
			for (const [locale, value] of Object.entries(overrides)) {
				search[locale as AvailableLocales] = value;
			}
		}
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

// SeasonParser only ever scrapes the EN season page for an egg's grouping
// comment (e.g. "Adventure Sync Rewards", "From Friend Gifts"), so its
// comment is EN-only by construction — this maps the exact scraped EN
// strings (verified against the live leekduck-eggs.json output) that have a
// confirmed data-mined source onto all 15 locales instead. Anything not
// listed here (e.g. "Gift from Matteo" — no confirmed source, see
// `game-translations-provider.ts`'s own DISPLAY_SOURCE_KEYS comment) is left
// for the caller to fall back to EN-only, same as before this existed.
const EGG_COMMENT_TRANSLATION_KEYS: Record<string, string> = {
	'Adventure Sync Rewards': 'adventureSyncRewards',
	'Route Rewards': 'routeRewards',
	'From Friend Gifts': 'friendGiftGroup',
};

export function localizeEggComment(
	scrapedEnglishText: string,
	translations: GameTranslations
): Partial<Record<AvailableLocales, string>> | undefined {
	const translationKey = EGG_COMMENT_TRANSLATION_KEYS[scrapedEnglishText];
	return translationKey ? translations[translationKey] : undefined;
}
