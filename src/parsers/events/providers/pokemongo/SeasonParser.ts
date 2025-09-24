import { JSDOM } from 'jsdom';

import type HttpDataFetcher from '../../../services/data-fetcher';
import {
	AvailableLocales,
	pairEventTranslations,
} from '../../../services/gamemaster-translator';
import type { IEntry, IParsedEvent } from '../../../types/events';
import type { GameMasterData, GameMasterPokemon } from '../../../types/pokemon';
import { parseEventDateRange } from '../../utils/normalization';
import PokemonMatcher, {
	extractPokemonSpeciesIdsFromElements,
} from '../../utils/pokemon-matcher';

// Helper to extract text content from a selector
const getText = (doc: Document, selector: string) =>
	doc.querySelector(selector)?.textContent?.trim() ?? '';

class SeasonParser {
	constructor(
		private readonly dataFetcher: HttpDataFetcher,
		private readonly domain: Array<GameMasterPokemon>
	) {}

	async fetchSeasonData(gameMasterPokemon: GameMasterData) {
		const seasonUrlBuilder = (locale: AvailableLocales) =>
			`https://pokemongo.com/${locale}/seasons`;
		const seasonsHtmls = await Promise.all(
			Object.values(AvailableLocales).map(async (locale) => ({
				locale,
				html: await this.dataFetcher.fetchText(seasonUrlBuilder(locale)),
			}))
		);

		const parsedSeasons: Array<IParsedEvent> = [];

		for (const season of seasonsHtmls) {
			const dom = new JSDOM(season.html);
			const doc = dom.window.document;

			const title = getText(doc, '.size\\:heading-1');

			const bonuses = Array.from(
				doc.querySelector('#seasonal-bonuses')?.children[1].children ?? []
			)
				.map((a) => a.textContent?.trim() ?? '')
				.filter(Boolean);

			if (season.locale !== AvailableLocales.en) {
				parsedSeasons.push({
					id: 'season',
					url: seasonUrlBuilder(season.locale),
					source: 'pokemongo',
					title: title,
					subtitle: title,
					imageUrl: '',
					startDate: 0,
					endDate: 0,
					wild: [],
					raids: [],
					incenses: [],
					eggs: [],
					researches: [],
					lures: [],
					bonuses: bonuses,
					isSeason: true,
					locale: season.locale,
					bonusSectionIndex: -1,
				});

				continue;
			}

			const imageUrl =
				doc.querySelector('#hero picture>img')?.getAttribute('src') ?? '';

			const dateText = getText(doc, '.size\\:subheading');
			let startDate = 0,
				endDate = 0;
			const dateRanges = parseEventDateRange(dateText);
			if (dateRanges.length > 0) {
				startDate = dateRanges[0].start;
				endDate = dateRanges[0].end;
			}

			// Wild spawns by zone (grouped lists, legacy order)
			const wild: Array<IEntry> = [];
			const appearing = Array.from(
				doc
					.getElementById('different-pokemon-appearing')
					?.querySelectorAll('[role=list]') ?? []
			);
			const wildGroups = [
				appearing[0], // city
				appearing[1], // forest
				appearing[2], // mountain
				appearing[3], // beach
				appearing[4], // north
				appearing[5], // south
			];
			wildGroups.forEach((group, i) => {
				if (group) {
					const entries = extractPokemonSpeciesIdsFromElements(
						Array.from(group.querySelectorAll('[role=listitem]')),
						new PokemonMatcher(gameMasterPokemon, this.domain)
					).map((f) => ({ ...f, kind: String(i) }));
					wild.push(...entries);
				}
			});

			// Research encounters (Field Research)
			const researches: Array<IEntry> = [];
			const researchList = doc.getElementById('research-breakthrough');
			if (researchList) {
				researches.push(
					...extractPokemonSpeciesIdsFromElements(
						Array.from(researchList.querySelectorAll('[role=listitem]')),
						new PokemonMatcher(gameMasterPokemon, this.domain)
					)
				);
			}

			// Eggs by distance/type (legacy order and comments, with correct index mapping)
			const eggs: Array<IEntry> = [];

			const tabs = Array.from(doc.querySelectorAll('#eggs [data-slot="tab"]'));
			const eggKinds = tabs.map((tab) => {
				const label = tab.querySelector('b')?.textContent ?? '';
				return label.replace(/\s*km Eggs\s*/i, '').trim(); // "2", "5", "7", "10" etc.
			});

			const panels = Array.from(
				doc.querySelectorAll('#eggs [data-slot="tabpanel"]')
			);

			panels.forEach((panel, i) => {
				const kind = eggKinds[i] ?? '';

				const figures = Array.from(panel.querySelectorAll('[role=figure]'));
				figures.forEach((figure) => {
					const commentText =
						figure
							.querySelector('._size\\:subheading_sfz9t_87')
							?.textContent?.trim() ?? null;

					// Só guarda se for múltiplas palavras (ex: "Adventure Sync", "Gift from Matteo")
					let comment: Partial<Record<AvailableLocales, string>> | undefined;
					if (commentText && commentText.split(/\s+/).length > 1) {
						comment = { [AvailableLocales.en]: commentText };
					}

					const listItems = Array.from(
						figure.querySelectorAll('[role=listitem]')
					);
					const entries = extractPokemonSpeciesIdsFromElements(
						listItems,
						new PokemonMatcher(gameMasterPokemon, this.domain)
					).map((f) => ({
						...f,
						kind,
						comment,
					}));

					eggs.push(...entries);
				});
			});

			parsedSeasons.push({
				id: 'season',
				url: seasonUrlBuilder(AvailableLocales.en),
				source: 'pokemongo',
				title: title,
				subtitle: title,
				imageUrl,
				startDate,
				endDate,
				wild,
				raids: [],
				incenses: [],
				eggs,
				researches,
				lures: [],
				bonuses: bonuses,
				isSeason: true,
				locale: season.locale,
				bonusSectionIndex: -1,
			});
		}

		const translatedSeason = pairEventTranslations(parsedSeasons);
		return translatedSeason[0];
	}
}

export default SeasonParser;
