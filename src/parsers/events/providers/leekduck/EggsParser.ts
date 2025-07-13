import { JSDOM } from 'jsdom';

import { HttpDataFetcher } from '../../../services/data-fetcher';
import { AvailableLocales, getEggCommentTranslation } from '../../../services/gamemaster-translator';
import { IEntry } from '../../../types/events';
import { GameMasterPokemon } from '../../../types/pokemon';
import { PokemonMatcher } from '../../utils/pokemon-matcher';

const LEEKDUCK_EGGS_URL = 'https://leekduck.com/eggs/';

export class EggsParser {
    constructor(
        private readonly dataFetcher: HttpDataFetcher,
        private readonly gameMasterPokemon: Record<string, GameMasterPokemon>,
        private readonly domain: Array<GameMasterPokemon>
    ) {}
    async parse() {
        const html = await this.dataFetcher.fetchText(LEEKDUCK_EGGS_URL);
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        const entries = Array.from(doc.querySelector('.page-content')?.children ?? []);
        const pokemons: Array<IEntry> = [];
        let km = '';

        let currentRawComment = '';
        const comment: Partial<Record<AvailableLocales, string>> = {};
        for (const entry of entries) {
            if (entry.tagName === 'H2') {
                const txt = (entry as HTMLElement).textContent?.trim() ?? '';
                km = txt.split(' ')[0];
                if (txt.includes('(')) {
                    currentRawComment = txt.substring(txt.indexOf('(') + 1, txt.lastIndexOf(')')).trim();
                    Object.values(AvailableLocales).forEach(
                        (locale) => (comment[locale] = getEggCommentTranslation(locale, currentRawComment))
                    );
                } else {
                    currentRawComment = '';
                    Object.values(AvailableLocales).forEach((locale) => (comment[locale] = ''));
                }
                continue;
            }
            if (entry.classList.contains('egg-list-flex')) {
                const pkmList = Array.from(entry.children).map(
                    (c) => (c.getElementsByClassName('hatch-pkmn')[0] as HTMLElement).textContent?.trim() ?? ''
                );
                const matcher = new PokemonMatcher(this.gameMasterPokemon, this.domain);
                const parsedPkm = matcher.matchPokemonFromText(pkmList).map((r) => {
                    return { ...r, kind: km, comment: { ...comment } };
                });
                pokemons.push(...parsedPkm);
            }
        }
        return pokemons;
    }
}
