import { JSDOM } from 'jsdom';

import type { IPokemonDomains } from '../../../pokemon/game-master-parser';
import type HttpDataFetcher from '../../../services/data-fetcher';
import type { GameTranslations } from '../../../services/game-translations-provider';
import {
	AvailableLocales,
	getSpotlightHourAndTranslation,
	getSpotlightHourBonusTranslation,
} from '../../../services/gamemaster-translator';
import type { IEntry } from '../../../types/events';
import type { GameMasterData, GameMasterPokemon } from '../../../types/pokemon';
import type { RichBlock } from '../../../types/rich-text';
import PokemonMatcher from '../../utils/pokemon-matcher';
import { richBlocksToLines } from '../../utils/rich-text';
import { MAX_MONDAY_BONUSES, MAX_MONDAY_NAMES } from './max-monday-bonuses';

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

/** One Max Monday: the Dynamax Pokémon that takes over the Power Spots for that Monday (they rotate weekly). */
export interface ILeekduckMaxMonday {
	title: Partial<Record<AvailableLocales, string>>;
	date: number;
	dateEnd: number;
	pokemons: Array<IEntry>;
	/** What a Max Monday brings, per locale: its bullet points and the asterisk footnote (the same for every Monday), as plain lines. */
	bonuses: Partial<Record<AvailableLocales, Array<string>>>;
	/** The same, with its formatting kept (bullet points, bold, the footnote as a note). */
	bonusBlocks: Partial<Record<AvailableLocales, Array<RichBlock>>>;
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

type ParsedEventCommon = {
	title: string;
	date: number;
	dateEnd: number;
	htmlDoc: Document;
};

// Reads the literal wall-clock date/time digits out of an ISO 8601 string
// and re-stamps them as UTC, discarding whatever offset the string itself
// carries (e.g. "2026-09-08T06:00:00-08:00" -> Date.UTC(2026, 8, 8, 6, 0)).
// go-pokedex's own time handling expects LeekDuck's displayed local time
// persisted this way, matching what the old #event-date-start/#event-time-
// start text-scraping produced.
const WALL_CLOCK_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;

function wallClockAsUtcMillis(isoString: string | null | undefined): number {
	if (!isoString) {
		return NaN;
	}
	const match = WALL_CLOCK_REGEX.exec(isoString);
	if (!match) {
		return NaN;
	}
	const [, year, month, day, hour, minute, second] = match;
	return Date.UTC(
		Number(year),
		Number(month) - 1,
		Number(day),
		Number(hour),
		Number(minute),
		Number(second)
	);
}

/** A Pokémon's name as the shiny marks are matched: lowercase, without a Shadow / Mega / Primal word or a bracketed form. */
const shinyNameKey = (name: string): string =>
	name
		.toLowerCase()
		.replace(/\(.*?\)/g, ' ')
		.replace(/\b(shadow|mega|primal)\b/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

class EventsParser {
	constructor(
		private readonly dataFetcher: HttpDataFetcher,
		private readonly gameMasterPokemon: GameMasterData,
		private readonly domains: IPokemonDomains,
		private readonly gameTranslations: GameTranslations,
		/** What a Max Monday brings, injected into every Max Monday as its bonuses (scraped once, see max-monday-bonuses.ts). */
		private readonly maxMondayBonuses: Partial<
			Record<AvailableLocales, Array<RichBlock>>
		> = MAX_MONDAY_BONUSES
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
		// Raid Hours (a Pokémon's five-star raids for an hour, weekly on Wednesdays) are special raid windows like the ones above.
		const raidHourUrls = Array.from(
			doc.getElementsByClassName('event-item-wrapper raid-hour')
		).map((e) => {
			return (e.parentElement as HTMLAnchorElement).href;
		});
		const maxMondayUrls = Array.from(
			doc.getElementsByClassName('event-item-wrapper max-mondays')
		).map((e) => {
			return (e.parentElement as HTMLAnchorElement).href;
		});
		const postUrls = Array.from(
			new Set([
				...raidUrls,
				...eliteRaidUrls,
				...spotlightUrls,
				...raidHourUrls,
				...maxMondayUrls,
			])
		);
		const urls = postUrls.map((e) => {
			return e.startsWith('http') ? e : LEEKDUCK_BASE_URL + e;
		});

		// How many event pages LeekDuck currently lists isn't knowable in
		// advance — widen the fetcher's progress denominator now that we
		// actually know, for this run.
		this.dataFetcher.announceExpectedFetches(urls.length);

		const spotlightHours: Array<ILeekduckSpotlightHour> = [];
		const specialRaidBosses: Array<ILeekduckSpecialRaidBoss> = [];
		const maxMondays: Array<ILeekduckMaxMonday> = [];

		const eventPromises = urls.map(async (url) => {
			try {
				const eventHtml = await this.dataFetcher.fetchText(url);
				const parsed = this.parseCommonEventFields(eventHtml);
				if (!parsed) {
					return;
				}
				if (parsed.title.includes('Max Monday')) {
					const maxMonday = this.parseMaxMondayEvent(parsed, url);
					if (maxMonday) {
						maxMondays.push(maxMonday);
					}
				} else if (parsed.title.includes('Spotlight')) {
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

			maxMondays: maxMondays.sort(
				(m1: ILeekduckMaxMonday, m2: ILeekduckMaxMonday) => {
					if (m1.date !== m2.date) {
						return m1.date - m2.date;
					}
					return m1.rawUrl.localeCompare(m2.rawUrl);
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

		// LeekDuck replaced the old #event-date-start/#event-time-start/
		// #event-date-end/#event-time-end text nodes with `.schedule-row`
		// elements carrying ready-to-parse ISO 8601 datetimes directly as
		// attributes. Two variants exist:
		//  - multi-day events: two rows, data-kind="start"/"end", each row's
		//    own datetime under data-start (yes, even the "end" row uses the
		//    attribute name data-start \u2014 it's disambiguated by data-kind);
		//  - single-day/short events: one row, data-kind="single", with both
		//    data-start and data-end on that same row.
		const rows = Array.from(
			htmlDoc.querySelectorAll('.times .schedule-row[data-segment]')
		);
		const startRow =
			rows.find((r) => r.getAttribute('data-kind') === 'start') ??
			rows.find((r) => r.getAttribute('data-kind') === 'single');
		const endRow =
			rows.find((r) => r.getAttribute('data-kind') === 'end') ??
			rows.find((r) => r.getAttribute('data-kind') === 'single');

		const startAttr = startRow?.getAttribute('data-start');
		const endAttr =
			endRow?.getAttribute('data-kind') === 'single'
				? endRow.getAttribute('data-end')
				: endRow?.getAttribute('data-start');

		// go-pokedex expects these as the displayed wall-clock time stamped
		// as if it were UTC (matching the old #event-date-start/#event-time-
		// start behavior), not the true UTC instant — so the attribute's own
		// "-08:00"/etc offset is deliberately dropped rather than applied.
		const date = wallClockAsUtcMillis(startAttr);
		const dateEnd = wallClockAsUtcMillis(endAttr);

		if (!title || Number.isNaN(date) || Number.isNaN(dateEnd)) {
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
			false,
			this.extractShinyNames(parsed.htmlDoc)
		);

		if (pokemons.length === 0) {
			return undefined;
		}

		const bonus = this.extractSpotlightBonus(parsed.htmlDoc);

		// "<species>: <spotlight-hour-event-name>" — the event-name half is
		// sourced live from the data-mined `spotlight_hour_event_name` key
		// (this.gameTranslations), not a hand-typed translation (see
		// game-translations-provider.ts's DISPLAY_SOURCE_KEYS.spotlightHour).
		// ` and ` between two species (dual-species Spotlight Hours) is the
		// only piece still website-copy, not game data — no data-mined
		// equivalent exists for that bare conjunction.
		const translatedTitles: Partial<Record<AvailableLocales, string>> = {};
		Object.values(AvailableLocales).forEach((locale) => {
			const localizedName = getSpotlightHourAndTranslation(locale, rawPkmName);
			const eventName = this.gameTranslations.spotlightHour?.[locale];
			translatedTitles[locale] = eventName
				? `${localizedName}: ${eventName}`
				: parsed.title;
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

	/**
	 * A Max Monday ("Dynamax Sizzlipede during Max Monday"): the page lists the featured Dynamax Pokémon like a Spotlight Hour
	 * does, each with the shiny icon when it can be shiny. Their entries are the base species, `kind` being the form.
	 */
	private parseMaxMondayEvent(
		parsed: ParsedEventCommon,
		url: string
	): ILeekduckMaxMonday | undefined {
		const form = /gigantamax/i.test(parsed.title) ? 'gigantamax' : 'dynamax';
		const shinyNames = this.extractShinyNames(parsed.htmlDoc);
		const listed = Array.from(
			parsed.htmlDoc.querySelectorAll('.pkmn-list-item')
		)
			.map(
				(item) => item.querySelector('.pkmn-name')?.textContent?.trim() ?? ''
			)
			// the list can carry the form word in front of the name
			.map((name) => name.replace(/^(?:dynamax|gigantamax)\s+/i, ''))
			.filter(Boolean);
		const fromTitle =
			/^(?:dynamax|gigantamax)\s+(.+?)\s+during\b/i.exec(parsed.title)?.[1] ??
			'';
		const names = listed.length > 0 ? listed : [fromTitle].filter(Boolean);

		const matcher = new PokemonMatcher(
			this.gameMasterPokemon,
			this.domains.nonMegaNonShadowDomain
		);
		const pokemons: Array<IEntry> = [];
		for (const name of names) {
			const entry = matcher.matchPokemonFromText([name])[0];
			if (
				entry?.speciesId &&
				!pokemons.some((p) => p.speciesId === entry.speciesId)
			) {
				pokemons.push({
					speciesId: entry.speciesId,
					kind: form,
					shiny: shinyNames.has(shinyNameKey(name)),
				});
			}
		}
		if (pokemons.length === 0) {
			return undefined;
		}

		// "<Dynamax species>: <Max Monday>", the way a Spotlight Hour is titled: the second half is what the season post calls a
		// Max Monday in that language (see MAX_MONDAY_NAMES), English where a language has none.
		const speciesPart = /^(.+?)\s+during\b/i.exec(parsed.title)?.[1];
		const translatedTitles: Partial<Record<AvailableLocales, string>> = {};
		Object.values(AvailableLocales).forEach((locale) => {
			const maxMonday =
				MAX_MONDAY_NAMES[locale] ?? MAX_MONDAY_NAMES[AvailableLocales.en];
			translatedTitles[locale] =
				speciesPart && maxMonday
					? `${speciesPart}: ${maxMonday}`
					: parsed.title;
		});

		return {
			title: translatedTitles,
			date: parsed.date,
			dateEnd: parsed.dateEnd,
			pokemons,
			bonuses: Object.fromEntries(
				Object.entries(this.maxMondayBonuses).map(([locale, blocks]) => [
					locale,
					richBlocksToLines(blocks),
				])
			),
			bonusBlocks: this.maxMondayBonuses,
			imgUrl:
				parsed.htmlDoc
					.querySelector('meta[property="og:image"]')
					?.getAttribute('content') ??
				'https://cdn.leekduck.com/assets/img/events/max-battles-kanto.jpg',
			rawUrl: url,
		};
	}

	private parseSpecialRaidBossEvent(
		parsed: ParsedEventCommon,
		gameMasterPokemon: GameMasterData,
		url: string
	): ILeekduckSpecialRaidBoss | undefined {
		const parts = parsed.title.split(' in ');
		// "Yveltal Raid Hour": the Pokémon is what comes before "Raid Hour"
		const rawPkmName = parts[0].replace(/\s+Raid Hour\b.*$/i, '');
		const raidType = parts[1] ?? '';
		const isShadow =
			raidType.includes('Shadow') || rawPkmName.includes('Shadow');
		const isMega = raidType.includes('Mega') || rawPkmName.includes('Mega');
		const pokemons = this.matchPokemonEntries(
			rawPkmName,
			gameMasterPokemon,
			isShadow,
			isMega,
			this.extractShinyNames(parsed.htmlDoc)
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
		isMega: boolean,
		shinyNames: ReadonlySet<string> = new Set()
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
					shiny: shinyNames.has(shinyNameKey(p)),
				});
			}
		}
		return entries;
	}

	/**
	 * The names (lowercased) of the Pokémon an event page lists with the shiny mark: each `.pkmn-list-item` carries an
	 * `img.shiny-icon` next to its `.pkmn-name` when that Pokémon can be shiny.
	 */
	private extractShinyNames(htmlDoc: Document): Set<string> {
		const names = new Set<string>();
		for (const item of Array.from(
			htmlDoc.querySelectorAll('.pkmn-list-item')
		)) {
			const name = item.querySelector('.pkmn-name')?.textContent?.trim();
			if (name && item.querySelector('.shiny-icon')) {
				names.add(shinyNameKey(name));
			}
		}
		return names;
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
