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

    // Wild spawns by zone (grouped lists, legacy order)
    const wild: IEntry[] = [];
    const appearing = Array.from(enDoc.getElementById('different-pokemon-appearing')?.querySelectorAll('[role=list]') ?? []);
    const wildGroups = [
        appearing[0], // city
        appearing[1], // forest
        appearing[2], // mountain
        appearing[3], // beach
        appearing[4], // north
        appearing[5]  // south
    ];
    wildGroups.forEach((group, i) => {
        if (group) {
            const entries = extractPokemonSpeciesIdsFromElements(Array.from(group.querySelectorAll('[role=listitem]')), new PokemonMatcher(gameMasterPokemon, domain)).map(f => ({ ...f, kind: String(i) }));
            wild.push(...entries);
        }
    });

    // Eggs by distance/type (legacy order and comments, with correct index mapping)
    const eggs: IEntry[] = [];
    const eggsElement = Array.from(enDoc.getElementById('eggs')?.querySelectorAll('[role=list]') ?? []);
    // Legacy index mapping:
    // 0: 2km, 1: 5km, 2: 5km (Adventure Sync), 3: 7km, 4: 7km (Route), 5: 10km, 6: 10km (Adventure Sync)
    const eggGroups = [
        eggsElement[0], // 2km
        eggsElement[1], // 5km
        eggsElement[3], // 7km
        eggsElement[5], // 10km
        eggsElement[2], // 5km (Adventure Sync)
        eggsElement[4], // 7km (Route)
        eggsElement[6]  // 10km (Adventure Sync)
    ];
    const eggKindMap = ["2", "5", "7", "10", "5", "7", "10"];

    // Helper to extract egg comments from a document
    const extractEggComments = (doc: Document): string[] =>
        Array.from(doc.getElementById('eggs')?.querySelectorAll('[role=figure] > div:first-child > div:first-child') ?? [])
            .filter(el => {
                const figure = el.closest('[role=figure]');
                const prev = figure?.previousElementSibling;
                return prev && [...prev.classList].some(cls => cls.includes('groupDivider'));
            })
            .map(el => el.textContent?.trim() ?? '');

    const commentsEn = extractEggComments(enDoc);
    const commentsPt = extractEggComments(ptDoc);

    eggGroups.forEach((group, i) => {
        if (group) {
            // For indexes 4, 5, 6 use the parsed comments array, otherwise undefined
            const comment = (i >= 4)
                ? { en: commentsEn[i - 4] || '', pt: commentsPt[i - 4] || '' }
                : undefined;
            const entries = extractPokemonSpeciesIdsFromElements(Array.from(group.querySelectorAll('[role=listitem]')), new PokemonMatcher(gameMasterPokemon, domain)).map(f => ({ ...f, kind: eggKindMap[i], comment }));
            eggs.push(...entries);
        }
    });

    // Research encounters (Field Research)
    const researches: IEntry[] = [];
    const researchList = enDoc.getElementById('encounter-pokemon');
    if (researchList) {
        researches.push(...extractPokemonSpeciesIdsFromElements(Array.from(researchList.querySelectorAll('[role=listitem]')), new PokemonMatcher(gameMasterPokemon, domain)));
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
        raids: [],
        incenses: [],
        eggs,
        researches,
        bonuses: {
            en: bonuses,
            pt: ptBonuses
        },
        isSeason: true
    };
} 