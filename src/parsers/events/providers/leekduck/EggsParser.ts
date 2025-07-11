import { IEntry } from '../../../types/events';
import { PokemonMatcher } from '../../utils/pokemon-matcher';
import { HttpDataFetcher } from '../../../services/data-fetcher';
import { JSDOM } from 'jsdom';
import { GameMasterPokemon } from '../../../types/pokemon';
import { AvailableLocales, getEggCommentTranslation } from '../../../services/gamemaster-translator';

const LEEKDUCK_EGGS_URL = 'https://leekduck.com/eggs/';

export class EggsParser {
    async parse(gameMasterPokemon: Record<string, GameMasterPokemon>): Promise<IEntry[]> {
        const fetcher = new HttpDataFetcher();
        const html = await fetcher.fetchText(LEEKDUCK_EGGS_URL);
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        const entries = Array.from(doc.querySelector('.page-content')?.children ?? []);
        const pokemons: IEntry[] = [];
        let km = '';
        const normalDomain = Object.values(gameMasterPokemon).filter((v: GameMasterPokemon) => !v.aliasId && !v.isShadow && !v.isMega);

        let currentRawComment = '';
        const comment: Partial<Record<AvailableLocales, string>> = {};
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            if (e.tagName === 'H2') {
                const txt = (e as HTMLElement).textContent?.trim() ?? '';
                km = txt.split(' ')[0];
                if (txt.includes('(')) {
                    currentRawComment = txt.substring(txt.indexOf('(') + 1, txt.lastIndexOf(')')).trim();
                    Object.values(AvailableLocales)
                        .forEach(locale => comment[locale] = getEggCommentTranslation(locale, currentRawComment));
                } else {
                    currentRawComment = '';
                    Object.values(AvailableLocales)
                        .forEach(locale => comment[locale] = '');
                }
                continue;
            }
            if (e.classList.contains('egg-list-flex')) {
                const pkmList = Array.from(e.children).map(c => (c.getElementsByClassName('hatch-pkmn')[0] as HTMLElement).textContent?.trim() ?? '');
                const matcher = new PokemonMatcher(gameMasterPokemon, normalDomain);
                const parsedPkm = matcher.matchPokemonFromText(pkmList).map(r => { return { ...r, kind: km, comment: {...comment} }; });
                pokemons.push(...parsedPkm);
            }
        }
        return pokemons;
    }
} 