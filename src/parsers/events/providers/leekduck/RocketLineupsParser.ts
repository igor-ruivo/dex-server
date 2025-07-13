import { JSDOM } from 'jsdom';

import { HttpDataFetcher } from '../../../services/data-fetcher';
import GameMasterTranslator, { AvailableLocales } from '../../../services/gamemaster-translator';
import { IRocketGrunt } from '../../../types/events';
import { GameMasterPokemon } from '../../../types/pokemon';
import { PokemonMatcher } from '../../utils/pokemon-matcher';

const LEEKDUCK_ROCKET_URL = 'https://leekduck.com/rocket-lineups/';

export class RocketLineupsParser {
    constructor(
        private readonly dataFetcher: HttpDataFetcher,
        private readonly gameMasterPokemon: Record<string, GameMasterPokemon>,
        private readonly translator: GameMasterTranslator
    ) {}
    parse = async () => {
        const html = await this.dataFetcher.fetchText(LEEKDUCK_ROCKET_URL);
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        const entries = Array.from(doc.getElementsByClassName('rocket-profile'));
        const answer: Array<IRocketGrunt> = [];
        const shadowDomain = Object.values(this.gameMasterPokemon).filter(
            (v: GameMasterPokemon) => !v.aliasId && !v.isShadow && !v.isMega
        );
        for (const entry of entries) {
            const trainerId =
                (entry.getElementsByClassName('name')[0] as HTMLElement)?.textContent
                    ?.replaceAll(/&nbsp;|\u00A0/g, ' ')
                    .trim() ?? '';
            const typeIdx = trainerId.indexOf('-type');
            const type = typeIdx !== -1 ? trainerId.substring(0, typeIdx).toLocaleLowerCase() : undefined;
            const tier1 = Array.from(
                entry.getElementsByClassName('lineup-info')[0].children[0].getElementsByClassName('shadow-pokemon')
            ).map((p) => (p as HTMLElement)?.getAttribute('data-pokemon')?.trim() ?? '');
            const tier2 = Array.from(
                entry.getElementsByClassName('lineup-info')[0].children[1].getElementsByClassName('shadow-pokemon')
            ).map((p) => (p as HTMLElement)?.getAttribute('data-pokemon')?.trim() ?? '');
            const tier3 = Array.from(
                entry.getElementsByClassName('lineup-info')[0].children[2].getElementsByClassName('shadow-pokemon')
            ).map((p) => (p as HTMLElement)?.getAttribute('data-pokemon')?.trim() ?? '');
            const matcher = new PokemonMatcher(this.gameMasterPokemon, shadowDomain);
            const tier1Pkms = matcher.matchPokemonFromText(tier1).map((e) => e.speciesId);
            const tier2Pkms = matcher.matchPokemonFromText(tier2).map((e) => e.speciesId);
            const tier3Pkms = matcher.matchPokemonFromText(tier3).map((e) => e.speciesId);
            const catchableTiers = Array.from(entry.getElementsByClassName('lineup-info')[0].children)
                .map((c: Element, i: number) => (c.classList.contains('encounter') ? i : undefined))
                .filter((e) => e !== undefined);

            const translatedPhrases: Partial<Record<AvailableLocales, string>> = {};
            Object.values(AvailableLocales).forEach(
                (locale) =>
                    (translatedPhrases[locale] = this.translator.getTranslationForRocketPhrase(locale, trainerId, type))
            );

            answer.push({
                phrase: translatedPhrases,
                type: type?.replace(/\s/g, ' ').trim(),
                trainerId: trainerId.replace(/\s/g, ' ').trim(),
                tier1: tier1Pkms,
                tier2: tier2Pkms,
                tier3: tier3Pkms,
                catchableTiers: catchableTiers,
            });
        }
        return answer;
    };
}
