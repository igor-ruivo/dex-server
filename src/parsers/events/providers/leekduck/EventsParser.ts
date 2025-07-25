import { JSDOM } from 'jsdom';

import type { IPokemonDomains } from '../../../pokemon/game-master-parser';
import type HttpDataFetcher from '../../../services/data-fetcher';
import {
	AvailableLocales,
	getSpotlightHourBonusTranslation,
	getSpotlightHourTranslation,
} from '../../../services/gamemaster-translator';
import type { IEntry } from '../../../types/events';
import type { GameMasterData, GameMasterPokemon } from '../../../types/pokemon';
import { parseDateFromString } from '../../utils/normalization';
import PokemonMatcher from '../../utils/pokemon-matcher';

const LEEKDUCK_EVENTS_URL = 'https://leekduck.com/events/';
const LEEKDUCK_BASE_URL = 'https://leekduck.com';

export interface ILeekduckSpotlightHour {
	title: Partial<Record<AvailableLocales, string>>;
	date: number;
	dateEnd: number;
	pokemons: Array<IEntry>;
	bonus?: Partial<Record<AvailableLocales, string>> | undefined;
	imgUrl?: string;
	rawUrl: string;
}

export interface ILeekduckSpecialRaidBoss {
	title: Partial<Record<AvailableLocales, string>>;
	date: number;
	dateEnd: number;
	raids: Array<IEntry>;
	rawUrl: string;
}

export interface ILeekduckEventsResult {
	spotlightHours: Array<ILeekduckSpotlightHour>;
	specialRaidBosses: Array<ILeekduckSpecialRaidBoss>;
}

type ParsedEventCommon = {
	title: string;
	date: number;
	dateEnd: number;
	htmlDoc: Document;
};

class EventsParser {
	constructor(
		private readonly dataFetcher: HttpDataFetcher,
		private readonly gameMasterPokemon: GameMasterData,
		private readonly domains: IPokemonDomains
	) {}
	async parse() {
		const html = await this.dataFetcher.fetchText(LEEKDUCK_EVENTS_URL);
		const dom = new JSDOM(html);
		const doc = dom.window.document;

		// Get all event links for raid and spotlight hour events
		const raidUrls = Array.from(
			doc.getElementsByClassName('event-item-wrapper raid-battles')
		).map((e) => {
			return (e.parentElement as HTMLAnchorElement).href;
		});
		const eliteRaidUrls = Array.from(
			doc.getElementsByClassName('event-item-wrapper elite-raids')
		).map((e) => {
			return (e.parentElement as HTMLAnchorElement).href;
		});
		const spotlightUrls = Array.from(
			doc.getElementsByClassName('event-item-wrapper pokémon-spotlight-hour')
		).map((e) => {
			return (e.parentElement as HTMLAnchorElement).href;
		});
		const postUrls = Array.from(
			new Set([...raidUrls, ...eliteRaidUrls, ...spotlightUrls])
		);
		const urls = postUrls.map((e) => {
			return e.startsWith('http') ? e : LEEKDUCK_BASE_URL + e;
		});

		const spotlightHours: Array<ILeekduckSpotlightHour> = [];
		const specialRaidBosses: Array<ILeekduckSpecialRaidBoss> = [];

		const eventPromises = urls.map(async (url) => {
			try {
				const eventHtml = await this.dataFetcher.fetchText(url);
				const parsed = this.parseCommonEventFields(eventHtml);
				if (!parsed) {
					return;
				}
				if (parsed.title.includes('Spotlight')) {
					const spotlightHour = this.parseSpotlightHourEvent(
						parsed,
						this.gameMasterPokemon,
						url
					);
					if (spotlightHour) {
						spotlightHours.push(spotlightHour);
					}
				} else {
					const specialRaidBoss = this.parseSpecialRaidBossEvent(
						parsed,
						this.gameMasterPokemon,
						url
					);
					if (specialRaidBoss) {
						specialRaidBosses.push(specialRaidBoss);
					}
				}
			} catch (err) {
				console.error(err);
			}
		});

		await Promise.all(eventPromises);

		return {
			spotlightHours: spotlightHours.sort(
				(s1: ILeekduckSpotlightHour, s2: ILeekduckSpotlightHour) => {
					if (s1.date !== s2.date) {
						return s1.date - s2.date;
					} else {
						return s1.rawUrl.localeCompare(s2.rawUrl);
					}
				}
			),

			specialRaidBosses: specialRaidBosses.sort(
				(s1: ILeekduckSpecialRaidBoss, s2: ILeekduckSpecialRaidBoss) => {
					if (s1.date !== s2.date) {
						return s1.date - s2.date;
					} else {
						return s1.rawUrl.localeCompare(s2.rawUrl);
					}
				}
			),
		};
	}

	private parseCommonEventFields(
		eventHtml: string
	): ParsedEventCommon | undefined {
		const dom = new JSDOM(eventHtml);
		const htmlDoc = dom.window.document;
		const title =
			htmlDoc
				.getElementsByClassName('page-title')[0]
				?.textContent?.replace(/\s/g, ' ')
				.trim() ?? '';
		const dateCont = (
			htmlDoc.getElementById('event-date-start')?.textContent?.trim() +
			' ' +
			htmlDoc.getElementById('event-time-start')?.textContent?.trim()
		)
			.replaceAll('  ', ' ')
			.replaceAll(/&nbsp;|\u00A0/g, ' ')
			.trim();
		const endCont = (
			htmlDoc.getElementById('event-date-end')?.textContent?.trim() +
			' ' +
			htmlDoc.getElementById('event-time-end')?.textContent?.trim()
		)
			.replaceAll('  ', ' ')
			.replaceAll(/&nbsp;|\u00A0/g, ' ')
			.trim();

		const date = parseDateFromString(dateCont);
		const dateEnd = parseDateFromString(endCont);

		if (!title || !date || !dateEnd) {
			return undefined;
		}

		return { title, date, dateEnd, htmlDoc };
	}

	private parseSpotlightHourEvent(
		parsed: ParsedEventCommon,
		gameMasterPokemon: GameMasterData,
		url: string
	): ILeekduckSpotlightHour | undefined {
		const rawPkmName = parsed.title.split('Spotlight')[0].trim();
		const pokemons = this.matchPokemonEntries(
			rawPkmName,
			gameMasterPokemon,
			false,
			false
		);
		const bonus = this.extractSpotlightBonus(parsed.htmlDoc);

		const translatedTitles: Partial<Record<AvailableLocales, string>> = {};
		Object.values(AvailableLocales).forEach((locale) => {
			translatedTitles[locale] = getSpotlightHourTranslation(
				locale,
				parsed.title
			);
		});

		return {
			title: translatedTitles,
			date: parsed.date,
			dateEnd: parsed.dateEnd,
			pokemons,
			bonus,
			imgUrl:
				'https://cdn.leekduck.com/assets/img/events/pokemonspotlighthour.jpg',
			rawUrl: url,
		};
	}

	private parseSpecialRaidBossEvent(
		parsed: ParsedEventCommon,
		gameMasterPokemon: GameMasterData,
		url: string
	): ILeekduckSpecialRaidBoss | undefined {
		const parts = parsed.title.split(' in ');
		const rawPkmName = parts[0];
		const raidType = parts[1] ?? '';
		const isShadow =
			raidType.includes('Shadow') || rawPkmName.includes('Shadow');
		const isMega = raidType.includes('Mega') || rawPkmName.includes('Mega');
		const pokemons = this.matchPokemonEntries(
			rawPkmName,
			gameMasterPokemon,
			isShadow,
			isMega
		);
		if (pokemons.length === 0) {
			return undefined;
		}

		const translatedTitles: Partial<Record<AvailableLocales, string>> = {};
		Object.values(AvailableLocales).forEach((locale) => {
			translatedTitles[locale] = parsed.title;
		});

		return {
			title: translatedTitles,
			date: parsed.date,
			dateEnd: parsed.dateEnd,
			raids: pokemons,
			rawUrl: url,
		};
	}

	private matchPokemonEntries(
		rawPkmName: string,
		gameMasterPokemon: GameMasterData,
		isShadow: boolean,
		isMega: boolean
	): Array<IEntry> {
		// The following domains aren't as restrictive as they could, because the current PokemonMatcher requires all the entries.
		let domainToUse: Array<GameMasterPokemon> = [];
		if (isShadow) {
			domainToUse = this.domains.nonMegaDomain;
		} else if (isMega) {
			domainToUse = this.domains.nonShadowDomain;
		} else {
			domainToUse = this.domains.nonMegaNonShadowDomain;
		}

		const names = rawPkmName
			.replaceAll(', ', ',')
			.replaceAll(' and ', ',')
			.split(',');
		const entries: Array<IEntry> = [];

		for (const name of names) {
			const p = name.trim();
			if (!p) {
				continue;
			}
			const matcher = new PokemonMatcher(gameMasterPokemon, domainToUse);
			const entry = matcher.matchPokemonFromText([p])[0];
			if (entry?.speciesId) {
				entries.push({
					speciesId: entry.speciesId,
					kind: isMega ? 'mega' : '5',
					shiny: false,
				});
			}
		}
		return entries;
	}

	private extractSpotlightBonus(htmlDoc: Document) {
		const desc = htmlDoc.getElementsByClassName('event-description')[0] as
			| HTMLElement
			| undefined;
		if (!desc) {
			return undefined;
		}
		const text = desc.textContent?.trim() ?? '';
		if (!text.includes('bonus is')) {
			return undefined;
		}
		const afterBonus = text.split('bonus is')[1];
		if (!afterBonus) {
			return undefined;
		}
		const bonus = afterBonus.split('.')[0].trim();

		const translatedBonuses: Partial<Record<AvailableLocales, string>> = {};
		Object.values(AvailableLocales).forEach((locale) => {
			translatedBonuses[locale] = getSpotlightHourBonusTranslation(
				locale,
				bonus
			);
		});

		return translatedBonuses;
	}
}

export default EventsParser;
