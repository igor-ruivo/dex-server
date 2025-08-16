import { JSDOM } from 'jsdom';

import type { IPokemonDomains } from '../../../pokemon/game-master-parser';
import type HttpDataFetcher from '../../../services/data-fetcher';
import type { IEntry } from '../../../types/events';
import type { GameMasterData } from '../../../types/pokemon';
import PokemonMatcher from '../../utils/pokemon-matcher';

const LEEKDUCK_BOSS_URL = 'https://leekduck.com/boss/';

type ClassAndMatcher = {
	classname: string;
	matcher: PokemonMatcher;
	prefix: string;
};

class BossesParser {
	constructor(
		private readonly dataFetcher: HttpDataFetcher,
		private readonly gameMasterPokemon: GameMasterData,
		private readonly domains: IPokemonDomains
	) {}

	private parseSection(
		doc: Document,
		classMatcher: ClassAndMatcher,
		pokemons: Array<IEntry>
	) {
		const entries = Array.from(
			doc.getElementsByClassName(classMatcher.classname)[0].children
		);

		for (const currentTier of entries) {
			let tier = '';
			const parsedTier =
				currentTier
					.getElementsByTagName('h2')[0]
					.textContent?.trim()
					.replaceAll('Shadow', '')
					.replaceAll('shadow', '')
					.trim() ?? '';
			if (parsedTier.split(' ').length === 2) {
				tier = parsedTier.split(' ')[1].toLocaleLowerCase();
			}

			if (parsedTier.split(' ').length === 1) {
				tier = parsedTier.toLocaleLowerCase();
			}

			if (tier === 'mega' || tier === '5') {
				continue;
			}

			const names = currentTier.getElementsByClassName('name');
			for (const name of names) {
				const parsedName = `${classMatcher.prefix} ${name.textContent?.trim()}`;

				const parsedPkm = classMatcher.matcher.matchPokemonFromText([
					parsedName,
				]);

				if (parsedPkm[0]) {
					pokemons.push({
						shiny: parsedPkm[0].shiny,
						speciesId: parsedPkm[0].speciesId,
						kind: tier,
					});
				}
			}
		}
	}

	async parse() {
		const html = await this.dataFetcher.fetchText(LEEKDUCK_BOSS_URL);
		const dom = new JSDOM(html);
		const doc = dom.window.document;

		const pokemons: Array<IEntry> = [];

		// The domain isn't as restrictive as it could, because the current PokemonMatcher requires all the entries.
		const normalMatcher = new PokemonMatcher(
			this.gameMasterPokemon,
			this.domains.normalDomain
		);

		const shadowMatcher = new PokemonMatcher(
			this.gameMasterPokemon,
			this.domains.nonMegaNonShadowDomain
		);

		[
			{ classname: 'raid-bosses', matcher: normalMatcher, prefix: '' },
			{
				classname: 'shadow-raid-bosses',
				matcher: shadowMatcher,
				prefix: 'Shadow',
			},
		].forEach((c) => this.parseSection(doc, c, pokemons));

		return pokemons;
	}
}

export default BossesParser;
