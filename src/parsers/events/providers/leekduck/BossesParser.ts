import { IPokemonDomains } from '@src/parsers/pokemon/game-master-parser';
import { JSDOM } from 'jsdom';

import { HttpDataFetcher } from '../../../services/data-fetcher';
import { IEntry } from '../../../types/events';
import { GameMasterPokemon } from '../../../types/pokemon';
import { PokemonMatcher } from '../../utils/pokemon-matcher';

const LEEKDUCK_BOSS_URL = 'https://leekduck.com/boss/';

export class BossesParser {
    constructor(
        private readonly dataFetcher: HttpDataFetcher,
        private readonly gameMasterPokemon: Record<string, GameMasterPokemon>,
        private readonly domains: IPokemonDomains
    ) {}
    async parse() {
        const html = await this.dataFetcher.fetchText(LEEKDUCK_BOSS_URL);
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        const entries = Array.from(doc.getElementsByClassName('list')[0].children);
        const shadowEntries = Array.from(doc.getElementsByClassName('list')[1].children);

        const pokemons: Array<IEntry> = [];

        let tier = '';

        const normalMatcher = new PokemonMatcher(this.gameMasterPokemon, this.domains.normalDomain);

        // The domain isn't as restrictive as it could, because the current PokemonMatcher requires all the entries.
        const shadowMatcher = new PokemonMatcher(this.gameMasterPokemon, this.domains.nonMegaNonShadowDomain);

        for (const entry of entries) {
            if (Array.from(entry.classList).includes('header-li')) {
                const newTier = (entry as HTMLElement).textContent?.trim() ?? '';
                if (newTier.split(' ').length === 2) {
                    tier = newTier.split(' ')[1].toLocaleLowerCase();
                }

                if (newTier.split(' ').length === 1) {
                    tier = newTier.toLocaleLowerCase();
                }
                continue;
            }

            if (tier === 'mega' || tier === '5') {
                continue;
            }

            if (!Array.from(entry.classList).includes('boss-item')) {
                continue;
            }

            const bossName = (entry.getElementsByClassName('boss-name')[0] as HTMLElement).textContent?.trim() ?? '';
            const parsedPkm = normalMatcher.matchPokemonFromText([bossName]);

            if (parsedPkm[0]) {
                pokemons.push({
                    shiny: parsedPkm[0].shiny,
                    speciesId: parsedPkm[0].speciesId,
                    kind: tier,
                });
            }
        }

        for (const entry of shadowEntries) {
            if (Array.from(entry.classList).includes('header-li')) {
                const newTier =
                    (entry as HTMLElement).textContent
                        ?.trim()
                        .replaceAll('Shadow', '')
                        .replaceAll('shadow', '')
                        .trim() ?? '';
                if (newTier.split(' ').length === 2) {
                    tier = newTier.split(' ')[1].toLocaleLowerCase();
                }

                if (newTier.split(' ').length === 1) {
                    tier = newTier.toLocaleLowerCase();
                }
                continue;
            }

            if (tier === 'mega' || tier === '5') {
                continue;
            }

            if (!Array.from(entry.classList).includes('boss-item')) {
                continue;
            }

            const bossName =
                'Shadow ' + ((entry.getElementsByClassName('boss-name')[0] as HTMLElement).textContent?.trim() ?? '');
            const parsedPkm = shadowMatcher.matchPokemonFromText([bossName]);

            if (parsedPkm[0]) {
                pokemons.push({
                    shiny: parsedPkm[0].shiny,
                    speciesId: parsedPkm[0].speciesId,
                    kind: tier,
                    shadow: true,
                });
            }
        }

        return pokemons;
    }
}
