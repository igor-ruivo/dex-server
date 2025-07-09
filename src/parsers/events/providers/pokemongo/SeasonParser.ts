import { PublicEvent, IEntry } from '../../../types/events';
import { PokemonMatcher, extractPokemonSpeciesIdsFromElements } from '../../utils/pokemon-matcher';
import { HttpDataFetcher } from '../../../services/data-fetcher';
import { JSDOM } from 'jsdom';
import { parseEventDateRange } from '../../utils/normalization';
import { GameMasterPokemon } from '../../../types/pokemon';

const EN_SEASON_URL = 'https://pokemongo.com/en/seasons';
const PT_SEASON_URL = 'https://pokemongo.com/pt_BR/seasons';

// Helper to extract text content from a selector
const getText = (doc: Document, selector: string) => doc.querySelector(selector)?.textContent?.trim() ?? '';

export async function fetchSeasonData(gameMasterPokemon: Record<string, GameMasterPokemon>, domain: Array<GameMasterPokemon>): Promise<PublicEvent> {
    const fetcher = new HttpDataFetcher();
    const [enHtml, ptHtml] = await Promise.all([
        fetcher.fetchText(EN_SEASON_URL),
        fetcher.fetchText(PT_SEASON_URL)
    ]);

    const enDom = new JSDOM(enHtml);
    const ptDom = new JSDOM(ptHtml);
    const enDoc = enDom.window.document;
    const ptDoc = ptDom.window.document;

    // Title
    const title = getText(enDoc, 'h1');
    const ptTitle = getText(ptDoc, 'h1');

    // Image
    const imageUrl = enDoc.querySelector('#hero picture>img')?.getAttribute('src') ?? '';

    // Dates (try to extract from the main header or subtitle)
    const dateText = getText(enDoc, '#hero-logo h1 + *');
    let startDate = 0, endDate = 0;
    const dateRanges = parseEventDateRange(dateText);
    if (dateRanges.length > 0) {
        startDate = dateRanges[0].start;
        endDate = dateRanges[0].end;
    }

    // Bonuses (EN and PT)
    const bonuses = Array.from(enDoc.querySelector('#seasonal-bonuses')?.children[1].children ?? [])
        .map(a => a.textContent?.trim() ?? '')
        .filter(Boolean)

    const ptBonuses = Array.from(ptDoc.querySelector('#seasonal-bonuses')?.children[1].children ?? [])
        .map(a => a.textContent?.trim() ?? '')
        .filter(Boolean)

    // Wild spawns by zone (grouped lists)
    const wild: IEntry[] = [];
    const wildSections = Array.from(enDoc.querySelectorAll('h3')).filter(e => /cities|forests|mountains|beaches|northern hemisphere|southern hemisphere/i.test(e.textContent ?? ''));
    wildSections.forEach((header, i) => {
        const list = header.nextElementSibling;
        if (list) {
            const entries = extractPokemonSpeciesIdsFromElements(Array.from(list.querySelectorAll('[role=listitem]')), new PokemonMatcher(gameMasterPokemon, domain)).map(f => ({ ...f, kind: String(i) }));
            wild.push(...entries);
        }
    });

    // Eggs by distance (grouped lists)
    const eggs: IEntry[] = [];
    const eggHeaders = Array.from(enDoc.querySelectorAll('h3')).filter(e => /\d+ km eggs?/i.test(e.textContent ?? ''));
    eggHeaders.forEach((header, i) => {
        const list = header.nextElementSibling;
        if (list) {
            const kindMatch = header.textContent?.match(/(\d+) km/i);
            const kind = kindMatch ? kindMatch[1] : String(i);
            const entries = extractPokemonSpeciesIdsFromElements(Array.from(list.querySelectorAll('[role=listitem]')), new PokemonMatcher(gameMasterPokemon, domain)).map(f => ({ ...f, kind }));
            eggs.push(...entries);
        }
    });

    // Research encounters (Field Research)
    const researches: IEntry[] = [];
    const researchHeader = Array.from(enDoc.querySelectorAll('h3')).find(e => /research breakthrough/i.test(e.textContent ?? ''));
    if (researchHeader) {
        const list = researchHeader.nextElementSibling;
        if (list) {
            researches.push(...extractPokemonSpeciesIdsFromElements(Array.from(list.querySelectorAll('[role=listitem]')), new PokemonMatcher(gameMasterPokemon, domain)));
        }
    }

    // Compose output
    return {
        id: 'season',
        url: EN_SEASON_URL,
        source: 'pokemongo',
        subtitle: {
            en: title,
            pt: ptTitle
        },
        title: {
            en: title,
            pt: ptTitle
        },
        imageUrl,
        startDate,
        endDate,
        wild,
        eggs,
        researches,
        bonuses: {
            en: bonuses,
            pt: ptBonuses
        },
        isSeason: true
    };
} 