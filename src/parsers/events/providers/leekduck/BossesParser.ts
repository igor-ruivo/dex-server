import { JSDOM } from 'jsdom';

import type { IPokemonDomains } from '../../../pokemon/game-master-parser';
import type HttpDataFetcher from '../../../services/data-fetcher';
import type { IEntry } from '../../../types/events';
import type { GameMasterData } from '../../../types/pokemon';
import PokemonMatcher from '../../utils/pokemon-matcher';

const LEEKDUCK_BOSS_URL = 'https://leekduck.com/raid-bosses/';

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
			// LeekDuck tags each tier's own header with a `data-tier`
			// attribute directly ("1", "3", "5", "Mega") now — reading it
			// beats parsing the header's own display text, which is what
			// broke: the old code assumed a specific word count/shape that
			// LeekDuck's rewording no longer guarantees.
			const tier = (
				currentTier.getElementsByTagName('h2')[0]?.getAttribute('data-tier') ??
				''
			).toLocaleLowerCase();

			// This page only ever holds the standing tier-1/tier-3 bosses;
			// tier 5, Mega, and Elite raids are event-scoped and come from
			// EventsParser instead.
			if (!tier || tier === 'mega' || tier === '5' || tier === 'super') {
				continue;
			}

			const names = currentTier.getElementsByClassName('name');
			for (const name of names) {
				const parsedName =
					`${classMatcher.prefix} ${name.textContent?.trim()}`.trim();

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
