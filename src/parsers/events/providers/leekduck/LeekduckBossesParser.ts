import { IEntry } from '../../../types/events';
import { PokemonMatcher } from '../../utils/pokemon-matcher';
import { HttpDataFetcher } from '../../../services/data-fetcher';
import { JSDOM } from 'jsdom';

const LEEKDUCK_BOSS_URL = 'https://leekduck.com/boss/';

export class LeekduckBossesParser {
    async parse(gameMasterPokemon: Record<string, any>): Promise<IEntry[]> {
        const fetcher = new HttpDataFetcher();
        const html = await fetcher.fetchText(LEEKDUCK_BOSS_URL);
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        // Find all boss entries (excluding 5-star and mega)
        const bossElements = Array.from(doc.querySelectorAll('.boss-list .boss-item'));
        const bosses: IEntry[] = [];
        const normalDomain = Object.values(gameMasterPokemon).filter((p: any) => !p.isShadow && !p.isMega && !p.aliasId);
        for (const el of bossElements) {
            // Exclude 5-star and mega
            const tier = el.querySelector('.boss-tier')?.textContent?.toLowerCase() ?? '';
            if (tier.includes('5-star') || tier.includes('mega')) continue;
            const name = el.querySelector('.boss-name')?.textContent?.trim() ?? '';
            if (!name) continue;
            const matcher = new PokemonMatcher(gameMasterPokemon, normalDomain);
            const entry = matcher.matchPokemonFromText([name])[0];
            if (entry?.speciesId) {
                bosses.push({
                    speciesId: entry.speciesId,
                    kind: tier,
                    shiny: false
                });
            }
        }
        return bosses;
    }
} 