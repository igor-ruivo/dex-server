import { IParsedEvent, PublicEvent } from '../types/events';
import { HttpDataFetcher } from './data-fetcher';

export enum AvailableLocales {
	en = 'en',
	ptbr = 'pt_br',
}

type ParsedSources = Partial<
	Record<
		AvailableLocales,
		{
			readonly translatedMovesDictionary: Record<string, string>;
			readonly translatedPhrasesDictionary: Record<string, string>;
		}
	>
>;

const LOCALE_GAME_MASTER_FILES: Record<AvailableLocales, string> = {
	[AvailableLocales.en]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_english.json',
	[AvailableLocales.ptbr]:
		'https://raw.githubusercontent.com/PokeMiners/pogo_assets/master/Texts/Latest%20APK/JSON/i18n_brazilianportuguese.json',
};

const SPOTLIGHT_HOUR_BONUS_TRANSLATIONS: Record<AvailableLocales, Record<string, string>> = {
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
};

const EGG_COMMENT_TRANSLATIONS: Record<AvailableLocales, Record<string, string>> = {
	// The source of truth is already in en
	[AvailableLocales.en]: {
		'Adventure Sync Rewards': 'Adventure Sync Rewards',
		'Route Rewards': 'Route Rewards',
		'From Route Gift': 'Route Rewards',
		"7 km Eggs from Mateo's Gift Exchange": "7 km Eggs from Mateo's Gift Exchange",
	},

	[AvailableLocales.ptbr]: {
		'Adventure Sync Rewards': 'Recompensas de Sincroaventura',
		'Route Rewards': 'Recompensas de Rota',
		'From Route Gift': 'Recompensas de Rota',
		"7 km Eggs from Mateo's Gift Exchange": 'Ovos de 7 km da Troca de presentes de Mateo',
	},
};

export const getSpotlightHourBonusTranslation = (locale: AvailableLocales, enPhrase: string) => {
	const dict = SPOTLIGHT_HOUR_BONUS_TRANSLATIONS[locale];
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

export const getEggCommentTranslation = (locale: AvailableLocales, enPhrase: string) => {
	const dict = EGG_COMMENT_TRANSLATIONS[locale];
	if (dict?.[enPhrase]) {
		return dict[enPhrase];
	}

	return enPhrase;
};

export const pairEventTranslations = (events: Array<IParsedEvent>): Array<PublicEvent> => {
	// Get all unique locales from AvailableLocales enum
	const locales: Array<AvailableLocales> = Object.values(AvailableLocales);

	// Group events by id and then by locale
	const eventsById: Record<string, Partial<Record<AvailableLocales, IParsedEvent>>> = {};

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

		// Build title, subtitle, and bonuses objects for all locales
		const title: Partial<Record<AvailableLocales, string>> = {};
		const subtitle: Partial<Record<AvailableLocales, string>> = {};
		const bonuses: Partial<Record<AvailableLocales, Array<string>>> = {};

		for (const locale of locales) {
			const localeEvent = localeEvents[locale];
			title[locale] = localeEvent ? localeEvent.title : '';
			subtitle[locale] = localeEvent ? localeEvent.subtitle : '';
			bonuses[locale] = localeEvent ? localeEvent.bonuses : [];

			if (locale === AvailableLocales.en) {
				continue;
			}

			enEvent.eggs.forEach((egg) => {
				if (!egg.comment?.en) {
					return;
				}

				const translatedComment = getEggCommentTranslation(locale, egg.comment.en);
				egg.comment[locale] = translatedComment;
			});
		}

		publicEvents.push({
			id: enEvent.id,
			url: enEvent.url,
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
	private readonly fetcher: HttpDataFetcher;
	private parsedSources: ParsedSources;

	constructor() {
		this.fetcher = new HttpDataFetcher();
		this.parsedSources = {};
	}

	private tryParseMove = (
		translatedMovesDictionary: Record<string, string>,
		dataEntry: string,
		expectedValue: string
	) => {
		const moveTerm = 'move_name_';

		if (dataEntry.startsWith(moveTerm)) {
			const key = dataEntry.substring(moveTerm.length);
			translatedMovesDictionary[key] = expectedValue;
		}
	};

	private tryParseRocketPhrase = (
		translatedPhrasesDictionary: Record<string, string>,
		dataEntry: string,
		expectedValue: string
	) => {
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
	};

	public setupGameMasterSources = async (): Promise<void> => {
		const results: Array<
			[
				AvailableLocales,
				{
					translatedMovesDictionary: Record<string, string>;
					translatedPhrasesDictionary: Record<string, string>;
				},
			]
		> = await Promise.all(
			Object.entries(LOCALE_GAME_MASTER_FILES).map(async ([locale, url]) => {
				const translationData = await this.fetcher.fetchJson<{ data: Array<string> }>(url);
				const translatedPhrasesDictionary: Record<string, string> = {};
				const translatedMovesDictionary: Record<string, string> = {};

				translationData.data.forEach((t, index) => {
					const value = translationData.data[index + 1];

					this.tryParseMove(translatedMovesDictionary, t, value);
					this.tryParseRocketPhrase(translatedPhrasesDictionary, t, value);
				});

				// Cast locale to AvailableLocales to ensure type safety
				return [
					locale as AvailableLocales,
					{
						translatedMovesDictionary,
						translatedPhrasesDictionary,
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
	};

	public getTranslationForMoveName = (locale: AvailableLocales, moveID: string) => {
		return this.parsedSources[locale]?.translatedMovesDictionary[moveID] ?? '';
	};

	public getTranslationForRocketPhrase = (locale: AvailableLocales, trainerId: string, type?: string): string => {
		const phrases = this.parsedSources[locale]?.translatedPhrasesDictionary;
		if (!phrases) {
			return '';
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

		return '';
	};
}

export default GameMasterTranslator;
