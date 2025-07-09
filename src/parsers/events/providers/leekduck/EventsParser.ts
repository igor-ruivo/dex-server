import { IEntry } from '../../../types/events';
import { PokemonMatcher } from '../../utils/pokemon-matcher';
import { HttpDataFetcher } from '../../../services/data-fetcher';
import { JSDOM } from 'jsdom';
import { parseDateFromString } from '../../utils/normalization';

const LEEKDUCK_EVENTS_URL = 'https://leekduck.com/events/';
const LEEKDUCK_BASE_URL = 'https://leekduck.com';

// Replace EventData with a local DTO for LeekDuck events
export interface ILeekduckEvent {
    title: string;
    date: number;
    dateEnd: number;
    raids?: IEntry[];
    spotlightPokemons?: IEntry[];
    spotlightBonus?: string;
    imgUrl?: string;
    rawUrl?: string;
}

export class EventsParser {
    async parse(gameMasterPokemon: Record<string, any>): Promise<ILeekduckEvent[]> {
        const fetcher = new HttpDataFetcher();
        const html = await fetcher.fetchText(LEEKDUCK_EVENTS_URL);
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        // Get all event links for raid and spotlight hour events
        const raidUrls = Array.from(doc.getElementsByClassName('event-item-wrapper raid-battles')).map(e => (e.parentElement as HTMLAnchorElement).href);
        const eliteRaidUrls = Array.from(doc.getElementsByClassName('event-item-wrapper elite-raids')).map(e => (e.parentElement as HTMLAnchorElement).href);
        const spotlightUrls = Array.from(doc.getElementsByClassName('event-item-wrapper pokémon-spotlight-hour')).map(e => (e.parentElement as HTMLAnchorElement).href);
        const postUrls = Array.from(new Set([...raidUrls, ...eliteRaidUrls, ...spotlightUrls]));
        const urls = postUrls.map(e => e.startsWith('http') ? e : LEEKDUCK_BASE_URL + e);

        // Fetch and parse each event
        const results: ILeekduckEvent[] = [];
        for (const url of urls) {
            try {
                const eventHtml = await fetcher.fetchText(url);
                const event = this.mapLeekNews(eventHtml, gameMasterPokemon);
                if (event && event.title) {
                    event.rawUrl = url;
                    results.push(event);
                }
            } catch (err) {
                // Ignore failed events
            }
        }
        return results;
    }

    private mapLeekNews(data: string, gameMasterPokemon: Record<string, any>): ILeekduckEvent {
        const dom = new JSDOM(data);
        const htmlDoc = dom.window.document;
        const title = htmlDoc.getElementsByClassName('page-title')[0]?.textContent?.replace(/\s/g, ' ').trim() ?? '';
        const dateCont = (htmlDoc.getElementById('event-date-start')?.textContent?.trim() + ' ' + htmlDoc.getElementById('event-time-start')?.textContent?.trim()).replaceAll('  ', ' ');
        const endCont = (htmlDoc.getElementById('event-date-end')?.textContent?.trim() + ' ' + htmlDoc.getElementById('event-time-end')?.textContent?.trim()).replaceAll('  ', ' ');
        
        const date = parseDateFromString(dateCont);
        const dateEnd = parseDateFromString(endCont);
        if (!title || !date || !dateEnd) {
            return { title: '', date: 0, dateEnd: 0 };
        }
        let rawPkmName = '';
        let isSpotlight = false;
        if (title.includes('Spotlight')) {
            isSpotlight = true;
            rawPkmName = title.split('Spotlight')[0].trim();
        }
        const parts = title.split(' in ');
        let raidType = '';
        if (!isSpotlight) {
            rawPkmName = parts[0];
            raidType = parts[1] ?? '';
        }
        let domainToUse: any[] = [];
        const isShadow = raidType.includes('Shadow') || rawPkmName.includes('Shadow');
        if (isShadow) {
            domainToUse = Object.values(gameMasterPokemon).filter((p: any) => !p.isMega && !p.aliasId);
        }
        const isMega = raidType.includes('Mega') || raidType.includes('Elite');
        if (isMega) {
            domainToUse = Object.values(gameMasterPokemon).filter((p: any) => !p.isShadow && !p.aliasId);
        }
        if (!isShadow && !isMega) {
            domainToUse = Object.values(gameMasterPokemon).filter((p: any) => !p.isShadow && !p.isMega && !p.aliasId);
        }
        const finalEntries: IEntry[] = [];
        const multiplePkms = rawPkmName.replaceAll(', ', ',').replaceAll(' and ', ',').split(',');
        for (let i = 0; i < multiplePkms.length; i++) {
            const p = multiplePkms[i].trim();
            const matcher = new PokemonMatcher(gameMasterPokemon, domainToUse);
            const entry = matcher.matchPokemonFromText([p])[0];
            if (entry?.speciesId) {
                finalEntries.push({
                    speciesId: entry.speciesId,
                    kind: isMega ? 'mega' : '5',
                    shiny: false
                });
            }
        }
        return {
            title,
            date,
            dateEnd,
            raids: !isSpotlight ? finalEntries : undefined,
            imgUrl: isSpotlight ? '/images/spotlight.png' : undefined,
            spotlightBonus: isSpotlight ? (htmlDoc.getElementsByClassName('event-description')[0] as HTMLElement)?.textContent?.trim().split('bonus is')[1]?.split('.')[0].trim() : undefined,
            spotlightPokemons: isSpotlight ? finalEntries : undefined
        };
    }
} 