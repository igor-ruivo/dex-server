import { JSDOM } from 'jsdom';

import type HttpDataFetcher from '../../../services/data-fetcher';
import {
	AvailableLocales,
	getEggCommentTranslation,
} from '../../../services/gamemaster-translator';
import type { IEntry } from '../../../types/events';
import type { GameMasterData, GameMasterPokemon } from '../../../types/pokemon';
import PokemonMatcher from '../../utils/pokemon-matcher';

const LEEKDUCK_EGGS_URL = 'https://leekduck.com/eggs/';

class EggsParser {
	constructor(
		private readonly dataFetcher: HttpDataFetcher,
		private readonly gameMasterPokemon: GameMasterData,
		private readonly domain: Array<GameMasterPokemon>
	) {}
	async parse() {
		const html = await this.dataFetcher.fetchText(LEEKDUCK_EGGS_URL);
		const dom = new JSDOM(html);
		const doc = dom.window.document;
		const entries = Array.from(
			doc.querySelector('.page-content')?.children ?? []
		);
		const pokemons: Array<IEntry> = [];
		let km = '';

		let currentRawComment = '';
		const comment: Partial<Record<AvailableLocales, string>> = {};
		for (const entry of entries) {
			if (entry.tagName === 'H2') {
				const txt = (entry as HTMLElement).textContent?.trim() ?? '';
				km = txt.split(' ')[0];
				if (txt.includes('(')) {
					currentRawComment = txt
						.substring(txt.indexOf('(') + 1, txt.lastIndexOf(')'))
						.trim();
					Object.values(AvailableLocales).forEach(
						(locale) =>
							(comment[locale] = getEggCommentTranslation(
								locale,
								currentRawComment
							))
					);
				} else {
					currentRawComment = '';
					Object.values(AvailableLocales).forEach(
						(locale) => (comment[locale] = '')
					);
				}
				continue;
			}
			if (entry.classList.contains('egg-grid')) {
				const cards = Array.from(entry.children).map((c) => ({
					name:
						(
							c.getElementsByClassName('name')[0] as HTMLElement | undefined
						)?.textContent?.trim() ?? '',
					shiny: !!c.querySelector('.shiny-icon'),
				}));
				const pkmList = cards.map((c) => c.name);
				const matcher = new PokemonMatcher(this.gameMasterPokemon, this.domain);
				// Matched card by card too: the list match drops repeats and unknown names, so its entries can't be lined up
				// with the cards by position.
				const shinyIds = new Set(
					cards
						.filter((c) => c.shiny)
						.flatMap((c) => matcher.matchPokemonFromText([c.name]))
						.map((r) => r.speciesId)
				);
				const parsedPkm = matcher.matchPokemonFromText(pkmList).map((r) => {
					return {
						...r,
						shiny: r.shiny || shinyIds.has(r.speciesId),
						kind: km,
						comment: { ...comment },
					};
				});
				pokemons.push(...parsedPkm);
			}
		}
		return pokemons;
	}
}

export default EggsParser;
