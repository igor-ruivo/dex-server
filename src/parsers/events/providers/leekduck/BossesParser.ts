import { IEntry } from '../../../types/events';
import { PokemonMatcher } from '../../utils/pokemon-matcher';
import { HttpDataFetcher } from '../../../services/data-fetcher';
import { JSDOM } from 'jsdom';
import { GameMasterPokemon } from '../../../types/pokemon';

const LEEKDUCK_BOSS_URL = 'https://leekduck.com/boss/';

export class BossesParser {
    async parse(gameMasterPokemon: Record<string, GameMasterPokemon>): Promise<IEntry[]> {
        const fetcher = new HttpDataFetcher();
        const html = await fetcher.fetchText(LEEKDUCK_BOSS_URL);
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        const entries = Array.from(doc.getElementsByClassName("list")[0].children);
        const shadowEntries = Array.from(doc.getElementsByClassName("list")[1].children);

        const pokemons: IEntry[] = [];

        let tier = "";

        const shadowDomain = Object.values(gameMasterPokemon).filter(v => !v.aliasId && !v.isMega);
        const megaDomain = Object.values(gameMasterPokemon).filter(v => !v.aliasId && !v.isShadow);
        const normalDomain = Object.values(gameMasterPokemon).filter(v => !v.aliasId && !v.isShadow && !v.isMega);

        const normalMatcher = new PokemonMatcher(gameMasterPokemon, normalDomain);
        const megaMatcher = new PokemonMatcher(gameMasterPokemon, megaDomain);
        const shadowMatcher = new PokemonMatcher(gameMasterPokemon, shadowDomain);

        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            if (Array.from(e.classList).includes("header-li")) {
                const newTier = (e as HTMLElement).textContent?.trim() ?? '';
                if (newTier.split(" ").length === 2) {
                    tier = newTier.split(" ")[1].toLocaleLowerCase();
                }

                if (newTier.split(" ").length === 1) {
                    tier = newTier.toLocaleLowerCase();
                }
                continue;
            }

            if (!Array.from(e.classList).includes("boss-item")) {
                continue;
            }

            const bossName = (e.getElementsByClassName("boss-name")[0] as HTMLElement).textContent?.trim() ?? '';
            const parsedPkm = tier === "mega" ?
                megaMatcher.matchPokemonFromText([bossName]): 
                normalMatcher.matchPokemonFromText([bossName]);
            
            if (parsedPkm[0] && tier !== "5" && tier !== "mega") {
                pokemons.push({
                    shiny: parsedPkm[0].shiny,
                    speciesId: parsedPkm[0].speciesId,
                    kind: tier
                });
            }
        }

        for (let i = 0; i < shadowEntries.length; i++) {
            const e = shadowEntries[i];
            if (Array.from(e.classList).includes("header-li")) {
                const newTier = (e as HTMLElement).textContent?.trim().replaceAll('Shadow', '').replaceAll('shadow', '').trim() ?? '';
                if (newTier.split(" ").length === 2) {
                    tier = newTier.split(" ")[1].toLocaleLowerCase();
                }

                if (newTier.split(" ").length === 1) {
                    tier = newTier.toLocaleLowerCase();
                }
                continue;
            }

            if (!Array.from(e.classList).includes("boss-item")) {
                continue;
            }

            const bossName = 'Shadow ' + ((e.getElementsByClassName("boss-name")[0] as HTMLElement).textContent?.trim() ?? '');
            const parsedPkm = shadowMatcher.matchPokemonFromText([bossName]);
            
            if (parsedPkm[0] && tier !== "5" && tier !== "mega") {
                pokemons.push({
                    shiny: parsedPkm[0].shiny,
                    speciesId: parsedPkm[0].speciesId,
                    kind: tier,
                    shadow: true
                });
            }
        }

        return pokemons;
    }
} 