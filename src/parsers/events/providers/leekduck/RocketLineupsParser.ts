import { IRocketGrunt } from '../../../types/events';
import { PokemonMatcher } from '../../utils/pokemon-matcher';
import { HttpDataFetcher } from '../../../services/data-fetcher';
import { JSDOM } from 'jsdom';
import { GameMasterPokemon } from '../../../types/pokemon';

const LEEKDUCK_ROCKET_URL = 'https://leekduck.com/rocket-lineups/';

export class RocketLineupsParser {
    async parse(gameMasterPokemon: Record<string, GameMasterPokemon>): Promise<IRocketGrunt[]> {
        const fetcher = new HttpDataFetcher();
        const html = await fetcher.fetchText(LEEKDUCK_ROCKET_URL);
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        const entries = Array.from(doc.getElementsByClassName('rocket-profile'));
        const answer: IRocketGrunt[] = [];
        const shadowDomain = Object.values(gameMasterPokemon).filter((v: GameMasterPokemon) => !v.aliasId && !v.isShadow && !v.isMega);
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];
            const trainerId = (e.getElementsByClassName('name')[0] as HTMLElement)?.textContent?.trim() ?? '';
            const typeIdx = trainerId.indexOf('-type');
            const type = typeIdx !== -1 ? trainerId.substring(0, typeIdx).toLocaleLowerCase() : undefined;
            const phrase = (e.getElementsByClassName('quote-text')[0] as HTMLElement)?.textContent?.trim() ?? '';
            const tier1 = Array.from(e.getElementsByClassName('lineup-info')[0].children[0].getElementsByClassName('shadow-pokemon')).map(p => (p as HTMLElement)?.getAttribute('data-pokemon')?.trim() ?? '');
            const tier2 = Array.from(e.getElementsByClassName('lineup-info')[0].children[1].getElementsByClassName('shadow-pokemon')).map(p => (p as HTMLElement)?.getAttribute('data-pokemon')?.trim() ?? '');
            const tier3 = Array.from(e.getElementsByClassName('lineup-info')[0].children[2].getElementsByClassName('shadow-pokemon')).map(p => (p as HTMLElement)?.getAttribute('data-pokemon')?.trim() ?? '');
            const matcher = new PokemonMatcher(gameMasterPokemon, shadowDomain);
            const tier1Pkms = matcher.matchPokemonFromText(tier1).map(e => e.speciesId);
            const tier2Pkms = matcher.matchPokemonFromText(tier2).map(e => e.speciesId);
            const tier3Pkms = matcher.matchPokemonFromText(tier3).map(e => e.speciesId);
            const catchableTiers = Array.from(e.getElementsByClassName('lineup-info')[0].children).map((c: Element, i: number) => c.classList.contains('encounter') ? i : undefined).filter(e => e !== undefined) as number[];
            answer.push({
                phrase: { en: phrase.replace(/\s/g, ' ').trim(), pt: '' },
                type: type?.replace(/\s/g, ' ').trim(),
                trainerId: trainerId.replace(/\s/g, ' ').trim(),
                tier1: tier1Pkms,
                tier2: tier2Pkms,
                tier3: tier3Pkms,
                catchableTiers: catchableTiers
            });
        }
        return answer;
    }
} 