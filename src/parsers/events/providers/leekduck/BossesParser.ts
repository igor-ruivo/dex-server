import { JSDOM } from 'jsdom';

import { HttpDataFetcher } from '../../../services/data-fetcher';
import { IEntry } from '../../../types/events';
import { GameMasterPokemon } from '../../../types/pokemon';
import { PokemonMatcher } from '../../utils/pokemon-matcher';

const LEEKDUCK_BOSS_URL = 'https://leekduck.com/boss/';

export class BossesParser {
    async parse(gameMasterPokemon: Record<string, GameMasterPokemon>): Promise<Array<IEntry>> {
        const fetcher = new HttpDataFetcher();
        const html = await fetcher.fetchText(LEEKDUCK_BOSS_URL);
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        const entries = Array.from(doc.getElementsByClassName('list')[0].children);
        const shadowEntries = Array.from(doc.getElementsByClassName('list')[1].children);

        const pokemons: Array<IEntry> = [];

        let tier = '';

        const shadowDomain = Object.values(gameMasterPokemon).filter((v) => !v.aliasId && !v.isMega);
        const megaDomain = Object.values(gameMasterPokemon).filter((v) => !v.aliasId && !v.isShadow);
        const normalDomain = Object.values(gameMasterPokemon).filter((v) => !v.aliasId && !v.isShadow && !v.isMega);

        const normalMatcher = new PokemonMatcher(gameMasterPokemon, normalDomain);
        const megaMatcher = new PokemonMatcher(gameMasterPokemon, megaDomain);
        const shadowMatcher = new PokemonMatcher(gameMasterPokemon, shadowDomain);

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

            if (!Array.from(entry.classList).includes('boss-item')) {
                continue;
            }

            const bossName = (entry.getElementsByClassName('boss-name')[0] as HTMLElement).textContent?.trim() ?? '';
            const parsedPkm =
                tier === 'mega'
                    ? megaMatcher.matchPokemonFromText([bossName])
                    : normalMatcher.matchPokemonFromText([bossName]);

            if (parsedPkm[0] && tier !== '5' && tier !== 'mega') {
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

            if (!Array.from(entry.classList).includes('boss-item')) {
                continue;
            }

            const bossName =
                'Shadow ' + ((entry.getElementsByClassName('boss-name')[0] as HTMLElement).textContent?.trim() ?? '');
            const parsedPkm = shadowMatcher.matchPokemonFromText([bossName]);

            if (parsedPkm[0] && tier !== '5' && tier !== 'mega') {
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
