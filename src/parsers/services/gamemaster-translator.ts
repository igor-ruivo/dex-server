import type { IParsedEvent, PublicEvent } from '../types/events';
import type HttpDataFetcher from './data-fetcher';

// Values match go-pokedex's own `GameLanguage` enum exactly
// (src/contexts/language-context.tsx there) — this repo publishes the JSON
// that app reads keyed by these strings, so the two must stay in lockstep.
// `ptbr` keeps the underscore (not the `pt-BR` every other consumer uses)
// for the same backward-compatibility reason documented on that enum: it's
// what's already published and already persisted in real users' storage.
export enum AvailableLocales {
	en = 'en',
	ptbr = 'pt_br',
	de = 'de',
	es = 'es',
	esMx = 'es-MX',
	fr = 'fr',
	hi = 'hi',
	id = 'id',
	it = 'it',
	ja = 'ja',
	ko = 'ko',
	ru = 'ru',
	th = 'th',
	tr = 'tr',
	zhHant = 'zh-Hant',
}

type ParsedSources = Partial<
	Record<
		AvailableLocales,
		{
			readonly translatedMovesDictionary: Record<string, string>;
			readonly translatedPhrasesDictionary: Record<string, string>;
			/** The full, unfiltered key→value string table for this locale —
			 *  everything `tryParseMove`/`tryParseRocketPhrase` don't already
			 *  extract. Kept so other consumers (e.g. `game-translations-provider.ts`,
			 *  which needs arbitrary keys like `filter_key_shadow` or
			 *  `pokemon_type_fire`) can look values up without re-fetching the
			 *  same 15 multi-MB files this class already downloaded. */
			readonly rawDictionary: Record<string, string>;
		}
	>
>;

// Every file here confirmed present in PokeMiners/pogo_assets as of
// 2026-09-21 (github.com/PokeMiners/pogo_assets/tree/master/Texts/Latest%20APK/JSON)
// — same data-mined, APK-extracted client string tables Niantic itself ships,
// one full locale set per file, alternating key/value pairs (see
// `setupGameMasterSources` below for how they're parsed).
const LOCALE_GAME_MASTER_FILES: Record<AvailableLocales, string> = {
	[AvailableLocales.en]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_english.json',
	[AvailableLocales.ptbr]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_brazilianportuguese.json',
	[AvailableLocales.de]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_german.json',
	[AvailableLocales.es]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_spanish.json',
	[AvailableLocales.esMx]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_latinamericanspanish.json',
	[AvailableLocales.fr]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_french.json',
	[AvailableLocales.hi]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_hindi.json',
	[AvailableLocales.id]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_indonesian.json',
	[AvailableLocales.it]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_italian.json',
	[AvailableLocales.ja]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_japanese.json',
	[AvailableLocales.ko]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_korean.json',
	[AvailableLocales.ru]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_russian.json',
	[AvailableLocales.th]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_thai.json',
	[AvailableLocales.tr]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_turkish.json',
	[AvailableLocales.zhHant]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_chinesetraditional.json',
};

// Just the bare " and " conjunction for dual-species Spotlight Hours
// ("Bulbasaur and Ivysaur Spotlight Hour") — the "Spotlight Hour" phrase
// itself now comes live from the data-mined `spotlight_hour_event_name` key
// (game-translations-provider.ts), not from a hand-typed map like this one.
const SPOTLIGHT_HOUR_AND_TRANSLATIONS: Record<
	AvailableLocales,
	Record<string, string>
> = {
	// The source of truth is already in en
	[AvailableLocales.en]: { ' and ': ' and ' },

	[AvailableLocales.ptbr]: { ' and ': ' e ' },

	// Not spreadsheet-sourced like GameTranslator.ts's search keywords in
	// go-pokedex — these are best-effort, not independently verified against
	// Niantic's own client strings. Worth double-checking if this ever gets
	// the same rigor as that file did.
	[AvailableLocales.de]: { ' and ': ' und ' },
	[AvailableLocales.es]: { ' and ': ' y ' },
	[AvailableLocales.esMx]: { ' and ': ' y ' },
	[AvailableLocales.fr]: { ' and ': ' et ' },
	[AvailableLocales.hi]: { ' and ': ' और ' },
	[AvailableLocales.id]: { ' and ': ' dan ' },
	[AvailableLocales.it]: { ' and ': ' e ' },
	[AvailableLocales.ja]: { ' and ': 'と' },
	[AvailableLocales.ko]: { ' and ': ' 및 ' },
	[AvailableLocales.ru]: { ' and ': ' и ' },
	[AvailableLocales.th]: { ' and ': ' และ ' },
	[AvailableLocales.tr]: { ' and ': ' ve ' },
	[AvailableLocales.zhHant]: { ' and ': '、' },
};

const SPOTLIGHT_HOUR_BONUS_TRANSLATIONS: Record<
	AvailableLocales,
	Record<string, string>
> = {
	// The source of truth is already in en
	[AvailableLocales.en]: {
		'Catch XP': 'Catch XP',
		'Catch Candy': 'Catch Candy',
		'Transfer Candy': 'Transfer Candy',
		'Evolution XP': 'Evolution XP',
		'Catch Stardust': 'Catch Stardust',
	},

	[AvailableLocales.ptbr]: {
		'Catch XP': 'XP ao capturar',
		'Catch Candy': 'Doces ao capturar',
		'Transfer Candy': 'Doces ao transferir',
		'Evolution XP': 'XP ao evoluir',
		'Catch Stardust': 'Poeira Estelar ao capturar',
	},

	// Best-effort, not independently verified — see the note on
	// SPOTLIGHT_HOUR_TITLE_TRANSLATIONS above.
	[AvailableLocales.de]: {
		'Catch XP': 'Fang-EP',
		'Catch Candy': 'Fang-Bonbons',
		'Transfer Candy': 'Austausch-Bonbons',
		'Evolution XP': 'Entwicklungs-EP',
		'Catch Stardust': 'Fang-Sternenstaub',
	},
	[AvailableLocales.es]: {
		'Catch XP': 'PE por captura',
		'Catch Candy': 'Caramelos por captura',
		'Transfer Candy': 'Caramelos por transferencia',
		'Evolution XP': 'PE por evolución',
		'Catch Stardust': 'Polvo Estelar por captura',
	},
	[AvailableLocales.esMx]: {
		'Catch XP': 'PE por captura',
		'Catch Candy': 'Caramelos por captura',
		'Transfer Candy': 'Caramelos por transferencia',
		'Evolution XP': 'PE por evolución',
		'Catch Stardust': 'Polvo Estelar por captura',
	},
	[AvailableLocales.fr]: {
		'Catch XP': 'PX de capture',
		'Catch Candy': 'Bonbons de capture',
		'Transfer Candy': 'Bonbons de transfert',
		'Evolution XP': "PX d'évolution",
		'Catch Stardust': "Poussière d'Étoile de capture",
	},
	[AvailableLocales.hi]: {
		'Catch XP': 'कैच XP',
		'Catch Candy': 'कैच कैंडी',
		'Transfer Candy': 'ट्रांसफर कैंडी',
		'Evolution XP': 'एवोल्यूशन XP',
		'Catch Stardust': 'कैच स्टारडस्ट',
	},
	[AvailableLocales.id]: {
		'Catch XP': 'XP Tangkap',
		'Catch Candy': 'Permen Tangkap',
		'Transfer Candy': 'Permen Transfer',
		'Evolution XP': 'XP Evolusi',
		'Catch Stardust': 'Stardust Tangkap',
	},
	[AvailableLocales.it]: {
		'Catch XP': 'PE da cattura',
		'Catch Candy': 'Caramelle da cattura',
		'Transfer Candy': 'Caramelle da scambio',
		'Evolution XP': 'PE da evoluzione',
		'Catch Stardust': 'Polvere Stellare da cattura',
	},
	[AvailableLocales.ja]: {
		'Catch XP': 'キャッチXP',
		'Catch Candy': 'キャッチアメ',
		'Transfer Candy': '交換アメ',
		'Evolution XP': '進化XP',
		'Catch Stardust': 'キャッチほしのすな',
	},
	[AvailableLocales.ko]: {
		'Catch XP': '포획 XP',
		'Catch Candy': '포획 사탕',
		'Transfer Candy': '교환 사탕',
		'Evolution XP': '진화 XP',
		'Catch Stardust': '포획 별의모래',
	},
	[AvailableLocales.ru]: {
		'Catch XP': 'XP за поимку',
		'Catch Candy': 'Конфеты за поимку',
		'Transfer Candy': 'Конфеты за обмен',
		'Evolution XP': 'XP за эволюцию',
		'Catch Stardust': 'Звёздная пыль за поимку',
	},
	[AvailableLocales.th]: {
		'Catch XP': 'XP จากการจับ',
		'Catch Candy': 'ลูกอมจากการจับ',
		'Transfer Candy': 'ลูกอมจากการแลกเปลี่ยน',
		'Evolution XP': 'XP จากการวิวัฒนาการ',
		'Catch Stardust': 'สตาร์ดัสต์จากการจับ',
	},
	[AvailableLocales.tr]: {
		'Catch XP': 'Yakalama XP',
		'Catch Candy': 'Yakalama Şekeri',
		'Transfer Candy': 'Transfer Şekeri',
		'Evolution XP': 'Evrim XP',
		'Catch Stardust': 'Yakalama Yıldız Tozu',
	},
	[AvailableLocales.zhHant]: {
		'Catch XP': '捕捉經驗值',
		'Catch Candy': '捕捉糖果',
		'Transfer Candy': '交換糖果',
		'Evolution XP': '進化經驗值',
		'Catch Stardust': '捕捉星塵',
	},
};

const EGG_COMMENT_TRANSLATIONS: Record<
	AvailableLocales,
	Record<string, string>
> = {
	// The source of truth is already in en
	[AvailableLocales.en]: {
		'Adventure Sync Rewards': 'Adventure Sync Rewards',
		'Route Rewards': 'Route Rewards',
		'From Route Gift': 'Route Rewards',
		"7 km Eggs from Mateo's Gift Exchange":
			"7 km Eggs from Mateo's Gift Exchange",
		'7 km Eggs from Mateo’s Gift Exchange':
			"7 km Eggs from Mateo's Gift Exchange",
	},

	[AvailableLocales.ptbr]: {
		'Adventure Sync Rewards': 'Recompensas de Sincroaventura',
		'Route Rewards': 'Recompensas de Rota',
		'From Route Gift': 'Recompensas de Rota',
		"7 km Eggs from Mateo's Gift Exchange":
			'Ovos de 7 km da Troca de presentes de Mateo',
		'7 km Eggs from Mateo’s Gift Exchange':
			'Ovos de 7 km da Troca de presentes de Mateo',
	},

	// Best-effort, not independently verified — see the note on
	// SPOTLIGHT_HOUR_TITLE_TRANSLATIONS above. "Mateo" is an NPC name, kept
	// unchanged in every locale.
	[AvailableLocales.de]: {
		'Adventure Sync Rewards': 'Adventure-Sync-Belohnungen',
		'Route Rewards': 'Routenbelohnungen',
		'From Route Gift': 'Routenbelohnungen',
		"7 km Eggs from Mateo's Gift Exchange":
			'7-km-Eier aus Mateos Geschenketausch',
		'7 km Eggs from Mateo’s Gift Exchange':
			'7-km-Eier aus Mateos Geschenketausch',
	},
	[AvailableLocales.es]: {
		'Adventure Sync Rewards': 'Recompensas de Sincronización de aventuras',
		'Route Rewards': 'Recompensas de rutas',
		'From Route Gift': 'Recompensas de rutas',
		"7 km Eggs from Mateo's Gift Exchange":
			'Huevos de 7 km del intercambio de regalos de Mateo',
		'7 km Eggs from Mateo’s Gift Exchange':
			'Huevos de 7 km del intercambio de regalos de Mateo',
	},
	[AvailableLocales.esMx]: {
		'Adventure Sync Rewards': 'Recompensas de Sincronización de aventuras',
		'Route Rewards': 'Recompensas de rutas',
		'From Route Gift': 'Recompensas de rutas',
		"7 km Eggs from Mateo's Gift Exchange":
			'Huevos de 7 km del intercambio de regalos de Mateo',
		'7 km Eggs from Mateo’s Gift Exchange':
			'Huevos de 7 km del intercambio de regalos de Mateo',
	},
	[AvailableLocales.fr]: {
		'Adventure Sync Rewards': 'Récompenses de Synchro Aventure',
		'Route Rewards': "Récompenses d'itinéraire",
		'From Route Gift': "Récompenses d'itinéraire",
		"7 km Eggs from Mateo's Gift Exchange":
			"Œufs de 7 km de l'échange de cadeaux de Mateo",
		'7 km Eggs from Mateo’s Gift Exchange':
			"Œufs de 7 km de l'échange de cadeaux de Mateo",
	},
	[AvailableLocales.hi]: {
		'Adventure Sync Rewards': 'एडवेंचर सिंक रिवॉर्ड्स',
		'Route Rewards': 'रूट रिवॉर्ड्स',
		'From Route Gift': 'रूट रिवॉर्ड्स',
		"7 km Eggs from Mateo's Gift Exchange":
			'मेटियो के गिफ्ट एक्सचेंज से 7 किमी के अंडे',
		'7 km Eggs from Mateo’s Gift Exchange':
			'मेटियो के गिफ्ट एक्सचेंज से 7 किमी के अंडे',
	},
	[AvailableLocales.id]: {
		'Adventure Sync Rewards': 'Hadiah Sinkronisasi Petualangan',
		'Route Rewards': 'Hadiah Rute',
		'From Route Gift': 'Hadiah Rute',
		"7 km Eggs from Mateo's Gift Exchange":
			'Telur 7 km dari Pertukaran Hadiah Mateo',
		'7 km Eggs from Mateo’s Gift Exchange':
			'Telur 7 km dari Pertukaran Hadiah Mateo',
	},
	[AvailableLocales.it]: {
		'Adventure Sync Rewards': 'Ricompense di Avventura Sync',
		'Route Rewards': 'Ricompense del percorso',
		'From Route Gift': 'Ricompense del percorso',
		"7 km Eggs from Mateo's Gift Exchange":
			'Uova da 7 km dallo scambio di doni di Mateo',
		'7 km Eggs from Mateo’s Gift Exchange':
			'Uova da 7 km dallo scambio di doni di Mateo',
	},
	[AvailableLocales.ja]: {
		'Adventure Sync Rewards': 'アドベンチャーシンクの報酬',
		'Route Rewards': 'ルートの報酬',
		'From Route Gift': 'ルートの報酬',
		"7 km Eggs from Mateo's Gift Exchange": 'マテオのギフト交換の7kmタマゴ',
		'7 km Eggs from Mateo’s Gift Exchange': 'マテオのギフト交換の7kmタマゴ',
	},
	[AvailableLocales.ko]: {
		'Adventure Sync Rewards': '어드벤처 싱크 보상',
		'Route Rewards': '루트 보상',
		'From Route Gift': '루트 보상',
		"7 km Eggs from Mateo's Gift Exchange": '마테오의 선물 교환 7km 알',
		'7 km Eggs from Mateo’s Gift Exchange': '마테오의 선물 교환 7km 알',
	},
	[AvailableLocales.ru]: {
		'Adventure Sync Rewards': 'Награды Adventure Sync',
		'Route Rewards': 'Награды за маршрут',
		'From Route Gift': 'Награды за маршрут',
		"7 km Eggs from Mateo's Gift Exchange":
			'Яйца 7 км из обмена подарками Матео',
		'7 km Eggs from Mateo’s Gift Exchange':
			'Яйца 7 км из обмена подарками Матео',
	},
	[AvailableLocales.th]: {
		'Adventure Sync Rewards': 'รางวัล Adventure Sync',
		'Route Rewards': 'รางวัลเส้นทาง',
		'From Route Gift': 'รางวัลเส้นทาง',
		"7 km Eggs from Mateo's Gift Exchange":
			'ไข่ 7 กม. จากการแลกของขวัญของมาเตโอ',
		'7 km Eggs from Mateo’s Gift Exchange':
			'ไข่ 7 กม. จากการแลกของขวัญของมาเตโอ',
	},
	[AvailableLocales.tr]: {
		'Adventure Sync Rewards': 'Macera Senkronu Ödülleri',
		'Route Rewards': 'Rota Ödülleri',
		'From Route Gift': 'Rota Ödülleri',
		"7 km Eggs from Mateo's Gift Exchange":
			"Mateo'nun Hediye Takasından 7 km Yumurtalar",
		'7 km Eggs from Mateo’s Gift Exchange':
			"Mateo'nun Hediye Takasından 7 km Yumurtalar",
	},
	[AvailableLocales.zhHant]: {
		'Adventure Sync Rewards': '冒險同步獎勵',
		'Route Rewards': '路線獎勵',
		'From Route Gift': '路線獎勵',
		"7 km Eggs from Mateo's Gift Exchange": '馬提歐禮物交換的7公里蛋',
		'7 km Eggs from Mateo’s Gift Exchange': '馬提歐禮物交換的7公里蛋',
	},
};

const replaceLocalizedStringComponents = (
	dict: Record<string, string>,
	enPhrase: string
) => {
	if (!dict) {
		return enPhrase;
	}

	let translated = enPhrase;
	for (const [key, value] of Object.entries(dict)) {
		if (key && value) {
			translated = translated.replaceAll(key, value);
		}
	}
	return translated;
};

export const getSpotlightHourAndTranslation = (
	locale: AvailableLocales,
	enPhrase: string
) => {
	return replaceLocalizedStringComponents(
		SPOTLIGHT_HOUR_AND_TRANSLATIONS[locale],
		enPhrase
	);
};

export const getSpotlightHourBonusTranslation = (
	locale: AvailableLocales,
	enPhrase: string
) => {
	return replaceLocalizedStringComponents(
		SPOTLIGHT_HOUR_BONUS_TRANSLATIONS[locale],
		enPhrase
	);
};

export const getEggCommentTranslation = (
	locale: AvailableLocales,
	enPhrase: string
) => {
	const dict = EGG_COMMENT_TRANSLATIONS[locale];
	if (dict?.[enPhrase]) {
		return dict[enPhrase];
	}

	return enPhrase;
};

export const pairEventTranslations = (
	events: Array<IParsedEvent>
): Array<PublicEvent> => {
	// Get all unique locales from AvailableLocales enum
	const locales: Array<AvailableLocales> = Object.values(AvailableLocales);

	// Group events by id and then by locale
	const eventsById: Record<
		string,
		Partial<Record<AvailableLocales, IParsedEvent>>
	> = {};

	for (const event of events) {
		if (!eventsById[event.id]) {
			eventsById[event.id] = {};
		}
		eventsById[event.id][event.locale] = event;
	}

	const publicEvents: Array<PublicEvent> = [];

	for (const [, localeEvents] of Object.entries(eventsById)) {
		// Always require an English event as the base
		const enEvent = localeEvents[AvailableLocales.en];
		if (!enEvent) {
			continue;
		}

		// Build url, title, subtitle, and bonuses objects for all locales
		const url: Partial<Record<AvailableLocales, string>> = {};
		const title: Partial<Record<AvailableLocales, string>> = {};
		const subtitle: Partial<Record<AvailableLocales, string>> = {};
		const bonuses: Partial<Record<AvailableLocales, Array<string>>> = {};

		for (const locale of locales) {
			const localeEvent = localeEvents[locale];
			// No translated post found for this locale/event — fall back to
			// the English content instead of shipping an empty string, same
			// reasoning as SeasonParser's own EN fallback. `localeEvent`
			// being `undefined` is the precise signal for "missing"; a
			// translated post that legitimately has no bonuses (a real,
			// non-empty page with an empty bonuses section) still gets its
			// own (empty) `bonuses` respected, not overwritten with EN's.
			url[locale] = localeEvent ? localeEvent.url : enEvent.url;
			title[locale] = localeEvent ? localeEvent.title : enEvent.title;
			subtitle[locale] = localeEvent ? localeEvent.subtitle : enEvent.subtitle;
			bonuses[locale] = localeEvent ? localeEvent.bonuses : enEvent.bonuses;

			if (locale === AvailableLocales.en) {
				continue;
			}

			enEvent.eggs.forEach((egg) => {
				if (!egg.comment?.en) {
					return;
				}

				const translatedComment = getEggCommentTranslation(
					locale,
					egg.comment.en
				);
				egg.comment[locale] = translatedComment;
			});
		}

		publicEvents.push({
			id: enEvent.id,
			url,
			title,
			subtitle,
			startDate: enEvent.startDate,
			endDate: enEvent.endDate,
			dateRanges: enEvent.dateRanges,
			imageUrl: enEvent.imageUrl,
			source: enEvent.source,
			wild: enEvent.wild,
			raids: enEvent.raids,
			eggs: enEvent.eggs,
			researches: enEvent.researches,
			incenses: enEvent.incenses,
			lures: enEvent.lures,
			bonuses,
		});
	}

	return publicEvents;
};

class GameMasterTranslator {
	private parsedSources: ParsedSources;

	constructor(private readonly dataFetcher: HttpDataFetcher) {
		this.parsedSources = {};
	}

	private tryParseMove(
		translatedMovesDictionary: Record<string, string>,
		dataEntry: string,
		expectedValue: string
	) {
		const moveTerm = 'move_name_';

		if (dataEntry.startsWith(moveTerm)) {
			const key = dataEntry.substring(moveTerm.length);
			translatedMovesDictionary[key] = expectedValue;
		}
	}

	private tryParseRocketPhrase(
		translatedPhrasesDictionary: Record<string, string>,
		dataEntry: string,
		expectedValue: string
	) {
		const gruntTerm = 'combat_grunt_quote';

		if (dataEntry.startsWith(gruntTerm)) {
			const key = dataEntry.substring(gruntTerm.length);
			translatedPhrasesDictionary[key] = expectedValue;
		}

		switch (dataEntry) {
			case 'combat_giovanni_quote#1':
				translatedPhrasesDictionary.Giovanni = expectedValue;
				break;
			case 'combat_cliff_quote#1':
				translatedPhrasesDictionary.Cliff = expectedValue;
				break;
			case 'combat_arlo_quote#1':
				translatedPhrasesDictionary.Arlo = expectedValue;
				break;
			case 'combat_sierra_quote#1':
				translatedPhrasesDictionary.Sierra = expectedValue;
				break;
			case 'combat_grunt_decoy_quote#1':
				translatedPhrasesDictionary['Decoy Female Grunt'] = expectedValue;
				break;
			case 'combat_grunt_quote#1__male_speaker':
				translatedPhrasesDictionary['Male Grunt'] = expectedValue;
				translatedPhrasesDictionary['Female Grunt'] = expectedValue;
				break;
			default:
				return;
		}
	}

	async setupGameMasterSources(): Promise<void> {
		const results: Array<
			[
				AvailableLocales,
				{
					translatedMovesDictionary: Record<string, string>;
					translatedPhrasesDictionary: Record<string, string>;
					rawDictionary: Record<string, string>;
				},
			]
		> = await Promise.all(
			Object.entries(LOCALE_GAME_MASTER_FILES).map(async ([locale, url]) => {
				const translationData = await this.dataFetcher.fetchJson<{
					data: Array<string>;
				}>(url);
				const translatedPhrasesDictionary: Record<string, string> = {};
				const translatedMovesDictionary: Record<string, string> = {};
				const rawDictionary: Record<string, string> = {};

				translationData.data.forEach((t, index) => {
					const value = translationData.data[index + 1];

					this.tryParseMove(translatedMovesDictionary, t, value);
					this.tryParseRocketPhrase(translatedPhrasesDictionary, t, value);
				});

				for (let i = 0; i < translationData.data.length; i += 2) {
					rawDictionary[translationData.data[i]] = translationData.data[i + 1];
				}

				// Cast locale to AvailableLocales to ensure type safety
				return [
					locale as AvailableLocales,
					{
						translatedMovesDictionary,
						translatedPhrasesDictionary,
						rawDictionary,
					},
				];
			})
		);

		// Build the parsedSources object in a type-safe way
		const parsedSources: ParsedSources = {};
		for (const [locale, dicts] of results) {
			parsedSources[locale] = dicts;
		}
		this.parsedSources = parsedSources;
	}

	getTranslationForMoveName(locale: AvailableLocales, moveID: string) {
		return this.parsedSources[locale]?.translatedMovesDictionary[moveID] ?? '';
	}

	/** Looks up an arbitrary data-mined string-table key for a locale — e.g.
	 *  `filter_key_shadow` or `pokemon_type_fire`. Used by
	 *  `game-translations-provider.ts` to source go-pokedex's GameTranslator
	 *  data without a second fetch of the same i18n files. */
	getRawString(locale: AvailableLocales, key: string): string | undefined {
		return this.parsedSources[locale]?.rawDictionary[key];
	}

	private lookupRocketPhrase(
		phrases: Record<string, string> | undefined,
		trainerId: string,
		type?: string
	): string | undefined {
		if (!phrases) {
			return undefined;
		}

		if (trainerId && phrases[trainerId]) {
			return phrases[trainerId];
		}

		if (type) {
			const typeKey = `_${type}__male_speaker`;
			if (phrases[typeKey]) {
				return phrases[typeKey];
			}
		}

		return undefined;
	}

	getTranslationForRocketPhrase(
		locale: AvailableLocales,
		trainerId: string,
		type?: string
	): string {
		const phrases = this.parsedSources[locale]?.translatedPhrasesDictionary;
		const found = this.lookupRocketPhrase(phrases, trainerId, type);
		if (found) {
			return found;
		}

		// Not found for the requested locale — fall back to English rather
		// than shipping an empty phrase, same reasoning as
		// `pairEventTranslations`'s own EN fallback.
		if (locale !== AvailableLocales.en) {
			const enPhrases =
				this.parsedSources[AvailableLocales.en]?.translatedPhrasesDictionary;
			const enFound = this.lookupRocketPhrase(enPhrases, trainerId, type);
			if (enFound) {
				return enFound;
			}
		}

		return '';
	}
}

export default GameMasterTranslator;
